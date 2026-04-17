import { NextResponse } from "next/server";
import { google } from "googleapis";
import { v2 as cloudinary } from "cloudinary";

// Google Sheets Service Account Credentials
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Cloudinary Credentials
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize the Google Auth client for Sheets
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: [
        "https://www.googleapis.com/auth/spreadsheets"
    ],
});

const sheets = google.sheets({ version: "v4", auth });

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const userId = formData.get("userId") as string | null;
        const fileName = formData.get("fileName") as string | null;
        const fullName = formData.get("fullName") as string;

        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            return NextResponse.json({ error: "Server Configuration Error: Missing Cloudinary credentials. Please restart 'npm run dev' to sync your .env variables!" }, { status: 500 });
        }

        if (!file || !userId || !fileName || !fullName) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to Cloudinary using a stream
        const safeFolderName = fullName.replace(/[^a-zA-Z0-9 ]/g, "").trim();
        const cloudinaryFolder = `Certificates/${safeFolderName}`;

        const uploadResult = await new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: cloudinaryFolder,
                    resource_type: "auto", // Automatically detect if it's pdf, image, etc.
                    public_id: fileName.split('.')[0] // remove extension so cloudinary handles it
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            uploadStream.end(buffer);
        });

        const fileUrl = uploadResult.secure_url;

        // Optionally, append to Google Sheets
        const email = formData.get("email") as string;
        const rollNumber = formData.get("rollNumber") as string;
        const department = formData.get("department") as string;
        const currentYear = formData.get("currentYear") as string;
        const academicYear = formData.get("academicYear") as string;
        const type = formData.get("type") as string;
        const eventName = formData.get("eventName") as string;
        const position = formData.get("position") as string || "";
        const date = formData.get("date") as string;

        if (GOOGLE_SHEET_ID && academicYear) {
            // User explicitly named the spreadsheet tabs identical to the dropdown values (e.g. "2022-23")
            const sheetTabName = academicYear;

            const values = [
                [
                    fullName,
                    email,
                    rollNumber,
                    department,
                    currentYear,
                    academicYear,
                    type,
                    eventName,
                    position,
                    date,
                    fileUrl
                ]
            ];

            try {
                // 1. Append the new row at the bottom
                await sheets.spreadsheets.values.append({
                    spreadsheetId: GOOGLE_SHEET_ID,
                    range: `${sheetTabName}!A:K`,
                    valueInputOption: "USER_ENTERED",
                    requestBody: {
                        values: values,
                    },
                });

                // 2. Fetch sheet properties to get the numerical sheetId of the sub-sheet
                const sheetMeta = await sheets.spreadsheets.get({
                    spreadsheetId: GOOGLE_SHEET_ID,
                    fields: 'sheets.properties(title,sheetId)',
                });

                const targetSheet = sheetMeta.data.sheets?.find(
                    s => s.properties?.title === sheetTabName
                );

                if (targetSheet && targetSheet.properties?.sheetId !== undefined) {
                    const specificSheetId = targetSheet.properties.sheetId;

                    // 3. Execute a sort operation on Column A (alphabetical order) ignoring the header row (index 0)
                    await sheets.spreadsheets.batchUpdate({
                        spreadsheetId: GOOGLE_SHEET_ID,
                        requestBody: {
                            requests: [
                                {
                                    sortRange: {
                                        range: {
                                            sheetId: specificSheetId,
                                            startRowIndex: 1, // Start sorting from row 2
                                            startColumnIndex: 0,
                                            endColumnIndex: 11, // Sort across columns A-K
                                        },
                                        sortSpecs: [
                                            {
                                                dimensionIndex: 0, // Column A (Name)
                                                sortOrder: "ASCENDING"
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    });
                }
            } catch (sheetErr: any) {
                console.error("Failed to append or sort Google Sheets:", sheetErr);
                // We won't block the submit if the sheet fails (e.g. sheet doesn't exist), but we'll log it.
            }
        }

        return NextResponse.json({
            success: true,
            url: fileUrl,
            id: uploadResult.public_id,
        });
    } catch (error: any) {
        console.error("Upload handler error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
