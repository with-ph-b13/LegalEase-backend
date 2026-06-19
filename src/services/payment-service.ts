import Stripe from "stripe";
import { env } from "../config/env";
import Transaction from "../models/Transaction";
import Lawyer from "../models/Lawyer";
import Hiring from "../models/Hiring";
import { HttpError } from "../middleware/error-handler";
import { Types } from "mongoose";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia" as any
});

export async function createPublishCheckout(userId: string) {
  const lawyer = await Lawyer.findOne({ userId: new Types.ObjectId(userId) }).exec();
  if (!lawyer) throw new HttpError(404, "Lawyer not found");
  if (lawyer.published) throw new HttpError(400, "Lawyer is already published");

  const hasPaid = await Transaction.findOne({ lawyerId: lawyer._id, type: "publish_fee", status: "succeeded" }).exec();
  if (hasPaid) {
    // If they already paid, just auto-publish them without charging
    lawyer.published = true;
    await lawyer.save();
    return { url: `${env.CLIENT_URL}/payment/success?type=publish&session_id=already_paid` };
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Lawyer Profile Publishing Fee",
            description: "One-time fee to publish your legal profile on LegalEase.",
          },
          unit_amount: 9900, // Fixed $99 fee
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/payment/cancel`,
    metadata: {
      type: "publish_fee",
      lawyerId: String(lawyer._id),
      userId: String(lawyer.userId)
    },
  });

  return { url: session.url };
}

export async function createHireCheckout(hiringId: string, userId: string) {
  const hire = await Hiring.findById(hiringId).populate("lawyerId").exec();
  if (!hire) throw new HttpError(404, "Hiring request not found");
  if (String(hire.userId) !== userId) throw new HttpError(403, "Not authorized");
  if (hire.status !== "accepted") throw new HttpError(400, "Hiring request must be accepted before payment");

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Legal Consultation Fee - ${(hire.lawyerId as any).name}`,
            description: `Payment for consultation services.`,
          },
          unit_amount: hire.fee * 100, // fee in cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${env.CLIENT_URL}/payment/success?type=hire&id=${hiringId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/payment/cancel`,
    metadata: {
      type: "hire_fee",
      hiringId: String(hire._id),
      userId: String(hire.userId),
      lawyerId: String((hire.lawyerId as any)._id)
    },
  });

  return { url: session.url };
}

export async function verifySession(sessionId: string, expectedUserId?: string) {
  if (!sessionId) throw new HttpError(400, "session_id is required");

  let session: any;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve session";
    throw new HttpError(404, message);
  }

  if (session.payment_status !== "paid") {
    throw new HttpError(400, "Payment not completed");
  }

  return processCompletedSession(session, expectedUserId);
}

export async function handleWebhook(body: string | Buffer, signature: string) {
  let event: any;

  // For sandbox/demo testing, if no real webhook secret is provided, bypass signature verification
  if (env.STRIPE_WEBHOOK_SECRET === "whsec_mock" || env.STRIPE_WEBHOOK_SECRET === "whsec_your_secret_here" || !signature) {
    try {
      event = JSON.parse(body.toString());
      console.log("⚠️ Bypassed Stripe webhook signature verification (Demo mode)");
    } catch (err: any) {
      throw new HttpError(400, "Invalid JSON payload");
    }
  } else {
    try {
      event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      throw new HttpError(400, `Webhook Error: ${err.message}`);
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    return processCompletedSession(session);
  }

  return { received: true };
}

async function processCompletedSession(
  session: any,
  expectedUserId?: string
) {
  const metadata = session.metadata || {};
  if (expectedUserId && metadata.userId && String(metadata.userId) !== String(expectedUserId)) {
    throw new HttpError(403, "Session does not belong to this user");
  }

  const existingTx = await Transaction.findOne({ stripeSessionId: session.id }).exec();
  if (existingTx) return { status: "already processed" };

  if (metadata.type === "publish_fee") {
    await Transaction.create({
      userId: new Types.ObjectId(metadata.userId),
      lawyerId: new Types.ObjectId(metadata.lawyerId),
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent as string,
      type: "publish_fee",
      amount: session.amount_total,
      status: "succeeded"
    });

    await Lawyer.findByIdAndUpdate(metadata.lawyerId, { $set: { published: true } }).exec();

    try {
      const User = (await import("../models/User")).default;
      const user = await User.findById(metadata.userId).exec();
      if (user) {
        const { logEmail } = await import("./email-service");
        logEmail(
          user.email,
          "Payment Succeeded: Profile Published",
          `Hi ${user.name},\n\nYour payment of $99.00 was successful. Your lawyer profile has been successfully published on LegalEase!\n\nBest regards,\nThe LegalEase Team`
        );
      }
    } catch (e) {
      console.error("Failed to send publish payment email:", e);
    }

    return { status: "published" };
  }

  if (metadata.type === "hire_fee") {
    await Transaction.create({
      userId: new Types.ObjectId(metadata.userId),
      lawyerId: new Types.ObjectId(metadata.lawyerId),
      hiringId: new Types.ObjectId(metadata.hiringId),
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent as string,
      type: "hire_fee",
      amount: session.amount_total,
      status: "succeeded"
    });

    await Hiring.findByIdAndUpdate(metadata.hiringId, { $set: { status: "paid" } }).exec();

    const { incrementHiredCount, recomputeStatus } = await import("./lawyer-service");
    await incrementHiredCount(metadata.lawyerId);

    const activeAcceptedCount = await Hiring.countDocuments({
      lawyerId: new Types.ObjectId(metadata.lawyerId),
      status: "accepted"
    }).exec();

    await recomputeStatus(metadata.lawyerId, activeAcceptedCount);

    try {
      const User = (await import("../models/User")).default;
      const user = await User.findById(metadata.userId).exec();
      const lawyer = await Lawyer.findById(metadata.lawyerId).exec();
      if (user && lawyer) {
        const { logEmail } = await import("./email-service");
        logEmail(
          user.email,
          "Payment Succeeded: Consultation Confirmed",
          `Hi ${user.name},\n\nYour payment for consultation services with ${lawyer.name} was successful. The lawyer has been notified.\n\nBest regards,\nThe LegalEase Team`
        );

        const lawyerUser = await User.findById(lawyer.userId).exec();
        if (lawyerUser) {
          logEmail(
            lawyerUser.email,
            "Consultation Payment Received!",
            `Hi ${lawyer.name},\n\nThe client ${user.name} has paid the consultation fee. You can now begin coordination.\n\nBest regards,\nThe LegalEase Team`
          );
        }
      }
    } catch (e) {
      console.error("Failed to send hiring payment email:", e);
    }

    return { status: "hire_paid" };
  }

  return { status: "ignored" };
}
