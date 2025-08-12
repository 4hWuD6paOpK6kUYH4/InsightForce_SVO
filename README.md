Insight Forge SVO - Automated Audio Generation
Executive Summary
Overview
The Insight Forge SVO is a powerful, script-based application designed to automate the generation of high-quality, multi-speaker audio files from text. It operates entirely within the Google Workspace ecosystem, leveraging a Google Sheet as a control hub, Google Drive for storage, and Google's Gemini API for advanced AI-driven text and speech generation.
The tool processes tasks on a row-by-row basis from the control sheet. Its core feature is a fully automated, self-restarting workflow that intelligently handles a large number of tasks without succumbing to Google Apps Script's execution time limits. By processing one row and then creating a one-time trigger to resume, it can work through an entire queue of audio generation tasks without manual intervention.
Key Features
Automated, Self-Restarting Workflow: Processes an entire list of tasks by handling one row at a time and programmatically setting a trigger to continue, effectively bypassing the 6-minute execution time limit.
Google Sheets Control Hub: A central sheet is used to define all tasks, specify inputs (text notes, voice configurations, output folders), and monitor the real-time status of each job.
Dynamic Dialogue & Monologue Generation: The script automatically detects whether one or two voices are specified for a task and instructs the AI to generate either a natural-sounding monologue or a two-person dialogue.
Per-Task Customization: Each row can have unique speaker notes, voices, and even a different Google Drive destination folder, offering maximum flexibility.
Configurable Voices: The script parses a user-friendly Speaker (Model) format directly from the sheet, allowing for easy assignment of any supported Gemini TTS voice model to any speaker name.
Custom Filename Generation: Automatically creates logical, descriptive filenames for each audio file based on the reference name, slide number, and speaker names provided in the sheet (e.g., ProjectX_001_Simon_and_Alex.wav).
Intelligent Processing: Automatically skips any rows that are already marked as "Completed," allowing the user to add new tasks and re-run the script without redoing finished work.
Modular & Centralized Configuration:
Prompts (Prompts.gs): All instructions sent to the Gemini API are stored in a separate file, allowing for easy editing and fine-tuning of the AI's creative output.
Models (Configuration.gs): The specific Gemini model versions used for text and audio generation are defined in a central configuration file, making future upgrades simple.
Robust WAV File Creation: The script correctly handles Gemini's raw audio/L16 output by programmatically building a valid 44-byte WAV header, ensuring the final files are playable in any standard media player.
Full User Control via Custom Menu: A simple menu in Google Sheets provides all necessary controls:
▶️ Start Automated Processing
⏹️ Cancel All Processing
🔄 Reset Progress
🔑 Set Gemini API Key
How It Works: The Automated Trigger Loop
The tool processes tasks defined in the Google Sheet. When initiated, it enters an automated loop managed by time-driven triggers.
Manual Start: The user clicks "Start Automated Processing" from the menu. This kicks off the first run.
Find Next Task: The script reads a saved property to know where it left off (or starts at the top). It then scans down the sheet to find the first row that has all required inputs and is not marked "Completed".
Process a Single Row: For the identified row, the script performs a sequence of actions:
It reads the inputs: Speaker Notes, Voice 1 Config, Voice 2 Config, and the destination Audio Folder ID.
It determines if a monologue or dialogue is needed based on whether a second voice is provided.
It calls the Gemini API (using the textModel) with a tailored prompt to generate the dialogue or monologue script.
It calls the Gemini TTS API (using the audioModel) with the generated script to create the raw audio data.
It builds a valid .wav file by prepending a 44-byte header to the raw audio data.
It saves the final .wav file to the specified Google Drive folder.
It updates the sheet row with the generated dialogue, a link to the audio file, and a "Completed" status.
Self-Restart:
If more tasks remain: The script programmatically creates a new, one-time trigger to run itself again in approximately 30 seconds. The current execution then ends.
If no more tasks remain: The script does not create a new trigger. It sends a completion email to the user, and the automated process stops.
Setup Instructions
1. Google Sheet ("Tasks")
Create a new Google Sheet.
Set up the following headers in the first row, exactly as listed:
A1: Ref
B1: Slide Number
C1: Speaker Notes
D1: Voice 1 Config
E1: Voice 2 Config
F1: Audio Folder
G1: Generated Dialogue
H1: Audio Link
I1: Status
2. Google Drive Folder
Create at least one Google Drive folder where you want your final audio files to be saved.
Open the folder and copy its ID from the URL bar (the long string of letters and numbers). You will paste this ID into the Audio Folder column in your sheet.
3. Apps Script Project
Create a new Apps Script project bound to your sheet (Extensions > Apps Script).
Create four script files by clicking the + icon next to Files. Name them exactly as follows and paste the provided code into each:
Code.gs
Triggers.gs
Prompts.gs
Configuration.gs
4. Google Cloud Platform (GCP) Project
Ensure your Apps Script project is linked to a standard GCP Project (Project Settings ⚙️).
In that GCP Project's console, enable the Vertex AI API.
Ensure billing is enabled for the project.
5. Set API Key
After saving the script files, reload your Google Sheet.
A new menu, "Audio Processor", will appear.
Click Audio Processor > 🔑 Set Gemini API Key.
Enter your valid GCP API key when prompted.
How to Use
Add a New Task: Add a new row to your sheet and fill in the input columns (A-F):
Ref: A project name for your filename (e.g., ProjectX).
Slide Number: A number for your filename (e.g., 1).
Speaker Notes: The text you want to convert to audio.
Voice 1 Config: The first speaker, in the format SpeakerName (VoiceModel) (e.g., Simon (Zephyr)).
Voice 2 Config: For a dialogue, add a second speaker in the same format. For a monologue, leave this cell blank.
Audio Folder: The Google Drive Folder ID where the file should be saved.
Start Processing: Click Audio Processor > ▶️ Start Automated Processing from the menu. The script will begin working in the background.
Monitor: You can watch the Status column update from "Processing..." to "Generating Audio..." and finally "Completed".
Access Output: The Audio Link column will be populated with a direct, clickable hyperlink to your generated .wav file.
Manage: Use the Cancel or Reset options in the menu if you need to stop the process or start over from the beginning. You'll receive an email when the entire queue is finished.
Script File Overview
Code.gs: Contains the main "worker" function (processRowLogic_) that handles the processing for a single row, along with all helper functions for parsing, file building, and API calls. Also contains the menu setup.
Triggers.gs: The orchestrator. Manages the automated trigger loop, including the functions called by the menu to start, cancel, and reset the process.
Prompts.gs: A library of all AI instructions (prompts) sent to the text generation model. Edit this file to change the AI's creative style.
Configuration.gs: A central file for key settings, including the specific Gemini model versions to be used for text and audio generation.
Considerations & Future Enhancements
Error Handling: The script reports errors in the Status column but does not automatically retry a failed row. More sophisticated recovery logic could be added.
Timeout on a Single Row: While the trigger system prevents timeouts between rows, an extremely long text in a single "Speaker Notes" cell could theoretically cause one of the two API calls to exceed the 6-minute limit. This is highly unlikely but possible.
Output Format: The script is currently hardcoded to produce .wav files. The logic could be adapted if future API versions support other formats like MP3.
Prompt Engineering: The quality of the generated dialogue is highly dependent on the prompts in Prompts.gs. Continuous iteration on these prompts is key to improving results.
