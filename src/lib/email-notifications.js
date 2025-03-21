import Mailjet from "node-mailjet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, "../../.env");

dotenv.config({
  path: envPath,
});

/**
 * Initialize the Mailjet client
 * @returns {Object} Configured Mailjet client
 */
export function initializeMailjet() {
  return new Mailjet({
    apiKey: process.env.MAILJET_API_TOKEN,
    apiSecret: process.env.MAILJET_API_SECRET,
  });
}

/**
 * Extract unique email contacts from menu tree
 * @param {Array} menuTree - The menu tree structure
 * @param {String} contactsField - The field name containing email contacts (default: 'errorNotificationContacts')
 * @returns {Set} Set of unique email addresses
 */
export function findEmailContacts(
  menuTree,
  contactsField = "errorNotificationContacts"
) {
  const contacts = new Set();

  menuTree.forEach((viewer) => {
    const contactsList = viewer[contactsField];

    if (contactsList && contactsList.length) {
      for (let { email } of contactsList) {
        contacts.add(email);
      }
    }
  });

  return contacts;
}

/**
 * Send an email using Mailjet
 * @param {String} toEmail - Recipient email address
 * @param {String} subject - Email subject
 * @param {String} htmlContent - HTML content of the email
 * @param {Object} mailjet - Initialized Mailjet client
 * @param {String} fromEmail - Email address to send from
 * @param {Array} attachments - Optional array of attachments
 * @returns {Promise} Promise resolving when email is sent
 */
export async function sendEmail(
  toEmail,
  subject,
  htmlContent,
  mailjet,
  fromEmail = process.env.MAILJET_FROM_EMAIL,
  attachments = []
) {
  console.log(`Sending email to ${toEmail}`);

  try {
    const messageData = {
      From: {
        Email: fromEmail,
      },
      To: [
        {
          Email: toEmail,
        },
      ],
      Subject: subject,
      HTMLPart: htmlContent,
    };

    if (attachments.length > 0) {
      messageData.Attachments = attachments;
    }

    const response = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [messageData],
    });

    console.log(response);
    return response;
  } catch (err) {
    console.error(`Error sending email to ${toEmail}:`, err);
    throw err;
  }
}

/**
 * Send error notification emails to all contacts
 * @param {Array} menuTree - The menu tree structure
 * @param {String} instanceName - Name of the instance where error occurred
 * @param {Error} error - The error object
 * @param {Object} mailjet - Initialized Mailjet client
 * @param {String} fromEmail - Email address to send from
 * @param {String} contactsField - The field name containing email contacts
 * @returns {Promise} Promise resolving when all emails are sent
 */
export async function sendErrorEmails(
  menuTree,
  instanceName,
  error,
  mailjet,
  fromEmail = process.env.MAILJET_FROM_EMAIL,
  contactsField = "errorNotificationContacts"
) {
  const contacts = findEmailContacts(menuTree, contactsField);

  for (const email of contacts) {
    const subject = `Error during external metadata sync for ${instanceName}`;
    const htmlContent = `
            <p>Hello,</p>
            <p>An error occurred during the external metadata synchronization process for ${instanceName}:</p>
            <p><strong>Error:</strong> ${error.message}</p>
            <p>Please check the system and resolve the issue.</p>
        `;

    try {
      await sendEmail(email, subject, htmlContent, mailjet, fromEmail);
    } catch (err) {
      console.error(`Failed to send error notification to ${email}:`, err);
    }
  }
}
