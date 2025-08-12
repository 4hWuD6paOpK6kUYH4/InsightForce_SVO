// Prompts.gs

/**
 * This object holds all the prompt templates for the Gemini API.
 * Using placeholders like {speaker1} makes them reusable.
 */
const PROMPT_TEMPLATES = {
  
  /**
   * Instruction for creating a conversation between two people.
   */
  dialogue: 'Convert the following notes into a natural, brief dialogue between "{speaker1}" and "{speaker2}". Start each line with the speaker\'s name and a colon.',
  
  /**
   * Instruction for creating a speech for one person.
   */
  monologue: 'Convert the following notes into a spoken monologue for a single speaker. Do not use speaker tags or labels. Just provide the plain text of the speech.'

};