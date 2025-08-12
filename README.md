# Insight Forge SVO - Slide Deck Audio Generation
## Executive Summary

### Overview
**Insight Forge SVO** is a robust, script-based application designed to automate the generation of high-quality, single- or multi-speaker audio files from text notes. Operating entirely within the Google Workspace ecosystem, it leverages a Google Sheet as a control hub, Google Drive for dynamic file storage, and Google's Gemini API for advanced AI-driven text and speech synthesis.

The application processes tasks on a row-by-row basis from the control sheet. Its core architectural feature is a fully automated, stateful, self-restarting workflow managed by time-driven triggers. This design intelligently handles large batch jobs by processing one row per execution, effectively bypassing Google Apps Script's 6-minute execution time limit and allowing for scalable, unattended operation. The architecture separates orchestration (`Triggers.gs`), core logic (`Code.gs`), and configurations (`Prompts.gs`, `Configuration.gs`) into distinct, maintainable script files.

---
## Key Features
* **Automated Trigger Loop:** A stateful, self-restarting workflow processes an entire queue of tasks by handling one row at a time and programmatically setting a trigger to continue. This architecture makes the system resilient to execution timeouts.
* **Google Sheets Control Hub:** A central spreadsheet acts as the user interface for defining tasks, specifying all inputs (source text, voice configurations, output folders), and monitoring the real-time status of each job.
* **Dynamic Dialogue & Monologue Generation:** The script inspects the input for one or two voice configurations and dynamically adjusts the AI prompt to generate either a natural-sounding monologue or a two-person dialogue.
* **Granular Per-Task Customization:** Each row is an independent task with its own unique text notes, voice actors, and a specific Google Drive destination folder, offering maximum flexibility.
* **Configurable Voices:** The script parses a user-friendly `Speaker (Model)` format (e.g., `Simon (Zephyr)`), allowing for the flexible assignment of any supported Gemini TTS voice model.
* **Dynamic Filename Generation:** Automatically constructs logical, descriptive filenames for each audio file based on data from the sheet (e.g., `ProjectX_001_Simon_and_Alex.wav`).
* **Idempotent Processing:** The script automatically skips any rows already marked as "Completed," allowing for safe re-runs without reprocessing finished work.
* **Modular & Centralized Configuration:**
    * **Prompts (`Prompts.gs`):** All natural language instructions sent to the Gemini API are externalized into a dedicated file, allowing for easy fine-tuning of the AI's creative output without altering the core logic.
    * **Models (`Configuration.gs`):** The specific Gemini model versions for text and audio generation are defined in a central configuration file for simple upgrades.
* **Robust WAV File Creation via Binary Manipulation:** The script correctly handles Gemini's raw `audio/L16;codec=pcm` output by programmatically constructing a valid 44-byte RIFF header using `ArrayBuffer` and `DataView`, ensuring the final files are playable `.wav` files.
* **Full User Control via Custom Menu:** A simple menu in Google Sheets provides all necessary controls: `▶️ Start`, `⏹️ Cancel`, `🔄 Reset`, and `🔑 Set API Key`.

---
## How It Works: The Automated Trigger Loop
The application's logic is orchestrated by a stateful trigger loop that ensures only one row is processed per execution.

1.  **Manual Initiation:** The user selects **"Start Automated Processing"** from the menu. This calls the `startProcessing()` function in `Triggers.gs`, which resets progress and immediately invokes the main processing function for the first time.
2.  **State Check & Task Identification:** The core function, `processOneRow()`, is executed. It reads the `nextRowToProcess` property from `PropertiesService` to determine where to start scanning. It then iterates downward from that row to find the first entry that has all required inputs and is not marked "Completed".
3.  **Single-Row Execution:** Once a target row is identified, `processOneRow()` calls the "worker" function, `processRowLogic_()` (located in `Code.gs`). This function executes the entire pipeline for that single row:
    * Parses the `Voice Config` inputs.
    * Calls `generateDialogue()` to make the first Gemini API call, using a dynamically selected prompt (monologue or dialogue) from `Prompts.gs` and the `textModel` from `Configuration.gs`.
    * Calls `generateGeminiAudio()` to make the second Gemini API call, using the appropriate single or multi-speaker payload structure and the `audioModel` from `Configuration.gs`.
    * Receives the raw Base64-encoded PCM data and passes it to `buildWavFileFromPcm()`.
    * `buildWavFileFromPcm()` constructs a 44-byte RIFF header and prepends it to the decoded audio data, forming a valid `.wav` file byte array.
    * The final byte array is saved to the Google Drive folder specified for that row.
    * The sheet is updated with the generated text, a hyperlink to the new file, and the "Completed" status.
4.  **State Update & Self-Trigger:**
    * After `processRowLogic_()` completes, `processOneRow()` updates the `nextRowToProcess` property in `PropertiesService` to the next row number.
    * It then programmatically creates a new, one-time `time-based trigger` to call itself (`processOneRow`) again in approximately 30 seconds. The current execution then terminates.
    * If no processable rows are found, the script cleans up all triggers and sends a completion email instead of creating a new trigger, thus ending the loop.

---
## Setup Instructions

#### 1. Google Sheet ("Tasks")
* Create a new Google Sheet.
* Set up the following headers in the first row, exactly as listed:
    * A1: `Ref`
    * B1: `Slide Number`
    * C1: `Speaker Notes`
    * D1: `Voice 1 Config`
    * E1: `Voice 2 Config`
    * F1: `Audio Folder`
    * G1: `Generated Dialogue`
    * H1: `Audio Link`
    * I1: `Status`

#### 2. Google Drive Folder
* Create one or more Google Drive folders to store the output audio files.
* For each folder, get its **ID** by navigating to it and copying the last part of the URL (the long string of characters).

#### 3. Apps Script Project
* Create a new Apps Script project bound to your sheet (**Extensions > Apps Script**).
* Create four script files by clicking the **+** icon next to **Files**. Name them exactly as follows and paste the corresponding code into each:
    * `Code.gs`
    * `Triggers.gs`
    * `Prompts.gs`
    * `Configuration.gs`
* **Note:** No "Advanced Google Services" need to be enabled in the Apps Script editor.

#### 4. Google Cloud Platform (GCP) Project
* Ensure your Apps Script project is linked to a standard GCP Project (**Project Settings ⚙️**).
* In that GCP Project's console, enable the **Vertex AI API**.
* Ensure billing is enabled for the project.

#### 5. Set API Key
* After saving all script files, **reload your Google Sheet**.
* A new menu, **"Audio Processor"**, will appear.
* Click **Audio Processor > 🔑 Set Gemini API Key**.
* Enter your valid GCP API key when prompted.

---
## How to Use
1.  **Add Tasks:** In the sheet, add a new row for each audio file you want to create. Fill in the input columns (A-F):
    * **Ref:** A project name for the filename (e.g., `ProjectX`).
    * **Slide Number:** A number for the filename (e.g., `1`).
    * **Speaker Notes:** The source text to be converted to audio.
    * **Voice 1 Config:** The first speaker, in the format `SpeakerName (VoiceModel)` (e.g., `Simon (Zephyr)`).
    * **Voice 2 Config:** For a dialogue, add a second speaker in the same format. **For a monologue, leave this cell blank.**
    * **Audio Folder:** The Google Drive Folder ID for the output file.
2.  **Start Processing:** Click **Audio Processor > ▶️ Start Automated Processing** from the menu. The script will begin working through all eligible rows in the background.
3.  **Monitor:** You can watch the `Status` column for real-time progress.
4.  **Access Output:** The `Audio Link` column will be populated with a direct hyperlink to the final `.wav` file.
5.  **Manage:** Use the **⏹️ Cancel All Processing** or **🔄 Reset Progress** menu options to stop the queue or start over from the beginning. You will receive an email when the entire job is finished.

---
## Script File Architecture
* **`Code.gs` (Execution/Library File):** Contains the primary "worker" function (`processRowLogic_`) that executes the core logic for a single row. It also holds all helper functions for parsing inputs, building the WAV file binary, and making API calls.
* **`Triggers.gs` (Stateful Orchestrator):** Manages the automated trigger loop. Contains the functions called by the user menu (`startProcessing`, `cancelProcessing`, `resetProgress`) and the main state-management function (`processOneRow`) that is called by the triggers.
* **`Prompts.gs` (Prompt Library):** A dedicated file containing all natural language instructions (prompts) sent to the text generation model. This is the primary file to edit for refining the AI's creative style.
* **`Configuration.gs` (Settings File):** A central file for static settings, primarily the specific Gemini model versions to be used for text and audio generation.

---
## Appendix: PowerPoint Audio Integration (VBA)

### Overview
A companion VBA (Visual Basic for Applications) macro is designed for Microsoft PowerPoint to complete the final step of the workflow. It takes a folder of audio files and automatically inserts each one into the corresponding slide of a presentation, creating a perfectly timed, self-running, narrated slideshow. This script is written in pure, native VBA to ensure maximum compatibility.

### Key Features
* **Folder-Based Batch Processing:** Prompts the user to select a single folder containing all the audio files.
* **Automatic Sorting:** Sorts audio files alphabetically, ensuring that files named with leading numbers (e.g., `..._001_...`, `..._002_...`) are inserted in the correct sequence.
* **One-to-One Slide Mapping:** Inserts the first sorted audio file into slide 1, the second into slide 2, and so on.
* **Automated Audio Configuration:** Sets audio to play on slide entry and hide the icon during the slideshow.
* **Automated Slide Transitions:** Precisely measures the duration of each audio clip and sets the slide to advance automatically when the audio finishes.
* **Multi-Format Support:** Accepts `.wav`, `.mp3`, and `.m4a` files.

### How to Set Up and Use the VBA Macro
1.  **Prepare Files:** Download the folder containing the generated `.wav` files from Google Drive to your computer.
2.  **Open PowerPoint:** Open the presentation you want to add the audio to.
3.  **Open VBA Editor:** Press **`Alt + F11`**.
4.  **Insert Module:** In the editor menu, click **Insert > Module**.
5.  **Paste Code:** Paste the `BatchInsertAndConfigureAudio_Native` VBA code into the new module.
6.  **Run Macro:** Press **`F5`** or run the macro via the **Developer > Macros** menu.
7.  **Select Folder:** When prompted, select the folder containing your downloaded audio files.
8.  **Done:** The script will insert and configure all audio. A message box will appear upon completion.

---
## Technical Considerations & Limitations
* **Error Handling:** The script reports the first error encountered for a row and stops processing that row. It does not automatically retry. Failed rows can be run again after fixing the input and clearing the "Error" status.
* **Single-Row Timeout:** While the trigger system prevents timeouts *between* rows, an exceptionally long `Speaker Notes` input could theoretically cause one of the two API calls in `processRowLogic_` to exceed the 6-minute limit. This is a rare edge case.
* **API Quotas & Costs:** This application makes calls to paid Google Cloud services. Be mindful of the costs associated with the Gemini API and ensure your project quotas are sufficient for large batch jobs.
* **Output Format:** The script is specifically configured to handle the `audio/L16;codec=pcm` output from the Gemini API and construct `.wav` files. Changes in the API's output format would require adjustments to the `buildWavFileFromPcm` function.
