// Code.gs

/**
 * Creates the custom menu in the spreadsheet.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Audio Processor')
    .addItem('▶️ Start Automated Processing', 'startProcessing')
    .addItem('⏹️ Cancel All Processing', 'cancelProcessing')
    .addSeparator()
    .addItem('🔄 Reset Progress', 'resetProgress')
    .addSeparator()
    .addItem('🔑 Set Gemini API Key', 'showApiKeyPrompt')
    .addToUi();
}

/**
 * Prompts the user to set their Google Cloud API key.
 * THIS FUNCTION HAS BEEN RESTORED.
 */
function showApiKeyPrompt() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt('Set Google Cloud API Key', 'Please enter your API key for the Vertex AI API.', ui.ButtonSet.OK_CANCEL);
  const button = result.getSelectedButton();
  const text = result.getResponseText();
  if (button == ui.Button.OK && text) {
    PropertiesService.getScriptProperties().setProperty('GCP_API_KEY', text);
    ui.alert('API Key Saved.', ui.ButtonSet.OK);
  }
}

/**
 * This is the "worker" function that performs the logic for a single row.
 * It is called by the trigger manager.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet object.
 * @param {number} rowNum The specific row number to process.
 */
function processRowLogic_(sheet, rowNum) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GCP_API_KEY');
  const rowData = sheet.getRange(rowNum, 1, 1, 9).getValues()[0];
  const statusCell = sheet.getRange(rowNum, 9); // Column I for Status
  
  try {
    const refName = rowData[0];
    const slideNumber = rowData[1];
    const speakerNotes = rowData[2];
    const voice1ConfigStr = rowData[3];
    const voice2ConfigStr = rowData[4];
    const folderId = rowData[5];
    
    sheet.getRange(rowNum, 7, 1, 2).clearContent(); // Clear old Dialogue and Link
    
    const voice1 = parseVoiceConfig(voice1ConfigStr);
    const voice2 = parseVoiceConfig(voice2ConfigStr);
    if (!voice1) throw new Error('Invalid Voice 1 Config');

    const folder = DriveApp.getFolderById(folderId);
    statusCell.setValue('Processing...');
    
    const dialogue = generateDialogue(speakerNotes, apiKey, voice1.speaker, voice2 ? voice2.speaker : null);
    sheet.getRange(rowNum, 7).setValue(dialogue);
    statusCell.setValue('Generating Audio...');
    
    const paddedSlideNumber = String(slideNumber).padStart(3, '0');
    const voiceNames = voice2 ? `${voice1.speaker}_and_${voice2.speaker}` : voice1.speaker;
    const fileName = `${refName}_${paddedSlideNumber}_${voiceNames}.wav`;

    const audioUrl = generateGeminiAudio(dialogue, fileName, apiKey, folder, voice1, voice2);
    sheet.getRange(rowNum, 8).setValue(audioUrl);
    statusCell.setValue('Completed');

  } catch(e) {
    statusCell.setValue(`Error: ${e.message}`);
  }
}

// --- HELPER FUNCTIONS ---

function parseVoiceConfig(configString) {
  if (typeof configString !== 'string' || !configString.includes('(') || !configString.endsWith(')')) return null;
  const parts = configString.slice(0, -1).split('(');
  if (parts.length !== 2) return null;
  const speaker = parts[0].trim();
  const model = parts[1].trim();
  if (!speaker || !model) return null;
  return { speaker, model };
}

function buildWavFileFromPcm(pcmData) {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = pcmData.length;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const fileSize = 36 + dataSize;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeString = (offset, str) => str.split('').forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  
  writeString(0, 'RIFF'); view.setUint32(4, fileSize, true); writeString(8, 'WAVE');
  writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true); writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  return [...new Uint8Array(header), ...pcmData];
}

function generateDialogue(notesText, apiKey, speaker1Name, speaker2Name) {
  let promptTemplate;
  let finalPrompt;
  if (speaker2Name) {
    promptTemplate = PROMPT_TEMPLATES.dialogue;
    finalPrompt = promptTemplate.replace('{speaker1}', speaker1Name).replace('{speaker2}', speaker2Name);
  } else {
    promptTemplate = PROMPT_TEMPLATES.monologue;
    finalPrompt = promptTemplate.replace('{speaker1}', speaker1Name);
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SCRIPT_CONFIG.textModel}:generateContent?key=${apiKey}`;
  const payload = { "contents": [{ "role": "user", "parts": [{ "text": `${finalPrompt}\n\nNOTES:\n${notesText}` }] }] };
  const options = { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload), 'muteHttpExceptions': true };
  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();
  
  const responseData = JSON.parse(responseText);
  if (responseData.candidates && responseData.candidates[0].content) {
    return responseData.candidates[0].content.parts[0].text.trim();
  }
  const errorMessage = responseData.error ? responseData.error.message : 'No content generated.';
  throw new Error(`Failed to generate dialogue: ${errorMessage}`);
}

function generateGeminiAudio(dialogue, fileName, apiKey, folder, voice1, voice2) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SCRIPT_CONFIG.audioModel}:generateContent?key=${apiKey}`;
  let speechConfig;
  if (voice2) {
    speechConfig = { "multiSpeakerVoiceConfig": { "speakerVoiceConfigs": [ { "speaker": voice1.speaker, "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": voice1.model } } }, { "speaker": voice2.speaker, "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": voice2.model } } } ] } };
  } else {
    speechConfig = { "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": voice1.model } } };
  }
  const payload = { "contents": [{ "parts": [{ "text": dialogue }] }], "generationConfig": { "responseModalities": ["AUDIO"], "speechConfig": speechConfig } };
  const options = { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload), 'muteHttpExceptions': true };
  const response = UrlFetchApp.fetch(url, options);
  const responseData = JSON.parse(response.getContentText());
  if (responseData.error) throw new Error(responseData.error.message || 'Failed to generate audio.');
  if (responseData.candidates && responseData.candidates[0].content.parts[0].inlineData) {
    const pcmData = Utilities.base64Decode(responseData.candidates[0].content.parts[0].inlineData.data);
    const wavBytes = buildWavFileFromPcm(pcmData);
    const audioBlob = Utilities.newBlob(wavBytes, MimeType.WAV, fileName);
    const existingFiles = folder.getFilesByName(fileName);
    if (existingFiles.hasNext()) { existingFiles.next().setTrashed(true); }
    const file = folder.createFile(audioBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  }
  throw new Error('Failed to generate audio due to unexpected response format.');
}