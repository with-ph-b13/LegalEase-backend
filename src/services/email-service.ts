import fs from "fs";
import path from "path";

const LOG_DIR = path.join(__dirname, "../../logs");
const LOG_FILE = path.join(LOG_DIR, "emails.log");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function logEmail(to: string, subject: string, body: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] TO: ${to} | SUBJECT: ${subject}\nBODY:\n${body}\n----------------------------------------\n`;
  
  fs.appendFile(LOG_FILE, logEntry, (err) => {
    if (err) {
      console.error("Failed to write email to log file", err);
    }
  });

  console.log(`📧 [Email Sent Stub] To: ${to} | Subject: ${subject}`);
}
