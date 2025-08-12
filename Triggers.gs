// Triggers.gs

const TRIGGER_FUNCTION_NAME = "processOneRow";

/**
 * Deletes all existing time-based triggers for this script to prevent duplicates.
 */
function deleteAllTriggers_() {
  const allTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === TRIGGER_FUNCTION_NAME) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  Logger.log("All existing processing triggers have been deleted.");
}

/**
 * Resets the script's progress. Called from the menu.
 */
function resetProgress() {
  deleteAllTriggers_();
  PropertiesService.getScriptProperties().deleteProperty('nextRowToProcess');
  // --- Replaced alert with a non-blocking toast message ---
  SpreadsheetApp.getActiveSpreadsheet().toast('Progress has been reset. The next run will start from the top.');
  Logger.log("--- PROGRESS RESET ---");
}

/**
 * Kicks off the very first run of the processing sequence. Called from the menu.
 */
function startProcessing() {
  const ui = SpreadsheetApp.getUi();
  // --- Removed the confirmation alert pop-up ---
  deleteAllTriggers_();
  PropertiesService.getScriptProperties().setProperty('nextRowToProcess', '2'); // Start at row 2
  SpreadsheetApp.getActiveSpreadsheet().toast('Starting automated processing...');
  processOneRow(); // Run the first one immediately
}

/**
 * Cancels any scheduled future runs. Called from the menu.
 */
function cancelProcessing() {
  deleteAllTriggers_();
  // --- Replaced alert with a non-blocking toast message ---
  SpreadsheetApp.getActiveSpreadsheet().toast('Processing has been canceled. No more rows will be automatically processed.');
  Logger.log("--- PROCESSING CANCELED BY USER ---");
}

/**
 * This is the core function that is called by the trigger.
 * It finds and processes the next available row and then sets a trigger for the next one.
 */
function processOneRow() {
  const properties = PropertiesService.getScriptProperties();
  const nextRowToProcess = parseInt(properties.getProperty('nextRowToProcess') || '2', 10);
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  let targetRow = -1;

  // Find the next row that needs processing
  for (let i = nextRowToProcess - 1; i < data.length; i++) {
    const status = data[i][8]; // Status in Column I
    const requiredInputs = data[i][2] && data[i][3] && data[i][5]; // Notes, Voice 1, Folder ID
    if (status !== 'Completed' && requiredInputs) {
      targetRow = i + 1;
      break;
    }
  }

  deleteAllTriggers_(); // Clean up before deciding to set a new one

  if (targetRow !== -1) {
    // A ROW WAS FOUND, PROCESS IT
    Logger.log(`--- Found target row to process: ${targetRow} ---`);
    processRowLogic_(sheet, targetRow); // Call the worker function
    
    properties.setProperty('nextRowToProcess', targetRow + 1); // Set the next starting point
    
    // Schedule the next run
    ScriptApp.newTrigger(TRIGGER_FUNCTION_NAME)
      .timeBased()
      .after(30 * 1000) // 30 seconds
      .create();
    Logger.log(`--- Successfully processed row ${targetRow}. Trigger set for next run. ---`);
    
  } else {
    // NO MORE ROWS TO PROCESS: Send a completion email
    Logger.log("--- No more rows to process. Process complete. Sending email notification. ---");
    const userEmail = Session.getActiveUser().getEmail();
    if (userEmail) {
        MailApp.sendEmail(
            userEmail, 
            "Audio Generation Complete", 
            "The automated script has finished processing all rows in your sheet."
        );
        Logger.log(`Completion email sent to ${userEmail}.`);
    }
  }
}