/**
 * Gemini Service - The "Architect"
 * Uses Gemini 1.5 Pro to analyze legal text and generate detailed image prompts
 * for Imagen 3 image generation
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ Warning: GEMINI_API_KEY not found. Infographic generation will not work.');
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Use gemini-1.5-pro-002 for best prompt engineering
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro-002' });
    }
  }
  
  /**
   * Generate image generation prompt from legal document text
   * Acts as "Prompt Engineer" - converts complex legal text into structured image prompt
   * 
   * @param {string} documentText - The legal document content to analyze
   * @returns {Promise<string>} Detailed image generation prompt for Imagen 3
   */
  async generateImagePrompt(documentText) {
    if (!this.model) {
      throw new Error('Gemini API not configured. GEMINI_API_KEY environment variable is required.');
    }
    
    const systemInstruction = `You are an expert Data Visualization Designer. Your goal is to take complex legal text and convert it into a prompt for an Image Generation AI (Imagen 3).

Rules for the Output Prompt:

Visual Style: Define the style strictly as: "Flat 2D vector art, corporate minimalist aesthetic, white background, professional legal color palette (Teal #008080, Muted Gold #C5A059, Dark Grey)."

Metaphor: Choose a central visual metaphor that fits the text (e.g., A Balance Scale for arguments, A Shield for protection, A Timeline for case history).

Layout: Describe the layout in spatial terms (e.g., "On the left side...", "In the center...").

Text: specific text strings must be wrapped in double quotes. Keep text short and punchy.

Task: Analyze the user's input and generate only the image generation prompt.

Use this NotebookLM-style template structure:

"A professional vector infographic on a white background. The subject is [TOPIC]. The central visual is [METAPHOR].

Left Column:
Icon: [ICON NAME] | Text: "[HEADER 1]" | Subtext: "[SHORT SUMMARY 1]"
Icon: [ICON NAME] | Text: "[HEADER 2]" | Subtext: "[SHORT SUMMARY 2]"

Right Column:
Icon: [ICON NAME] | Text: "[HEADER 3]" | Subtext: "[SHORT SUMMARY 3]"

Style: Flat design, clean lines, corporate color palette (Teal #008080, Muted Gold #C5A059, Dark Grey). No photorealism. High legibility text. All text must be clearly readable and accurately spelled."

Return ONLY the image generation prompt, no explanations, no markdown formatting.`;

    const prompt = `Analyze the following legal document and create a detailed image generation prompt following the NotebookLM infographic style:

${documentText}

Generate a prompt that will create a professional, balanced-scale style infographic showing the key legal arguments, timeline, or case structure. Focus on:
1. A clear central visual metaphor (balance scale, timeline, shield, etc.)
2. Left side: Key facts, arguments, or chronology
3. Right side: Legal challenges, responses, or outcomes
4. Icons and labels for each key point
5. Professional color scheme and clean typography`;

    try {
      console.log('[GeminiService] Generating image prompt from document...');
      
      const result = await this.model.generateContent(prompt, {
        systemInstruction: systemInstruction,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      });
      
      const response = await result.response;
      const promptText = response.text().trim();
      
      // Clean up the prompt - remove markdown code blocks if present
      let cleanPrompt = promptText
        .replace(/^```[\w]*\n?/g, '')
        .replace(/```$/g, '')
        .trim();
      
      console.log('[GeminiService] ✅ Image prompt generated successfully');
      return cleanPrompt;
      
    } catch (error) {
      console.error('[GeminiService] ❌ Error generating prompt:', error.message);
      throw new Error(`Failed to generate image prompt: ${error.message}`);
    }
  }
  
  /**
   * Analyze document and extract key information for infographic
   * 
   * @param {string} documentText - Document content
   * @returns {Promise<Object>} Analyzed document structure with key points
   */
  async analyzeDocument(documentText) {
    if (!this.model) {
      throw new Error('Gemini API not configured.');
    }
    
    const analysisPrompt = `Analyze this legal document and extract:
1. Main topic/subject
2. Key parties involved
3. Timeline of events (if any)
4. Main arguments or claims
5. Central legal question or dispute
6. Suggested visual metaphor (balance scale, timeline, shield, etc.)

Document:
${documentText.substring(0, 10000)} // Limit to first 10k chars

Return a JSON object with these fields.`;

    try {
      const result = await this.model.generateContent(analysisPrompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error) {
      console.error('[GeminiService] Error analyzing document:', error.message);
      throw new Error(`Failed to analyze document: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new GeminiService();



