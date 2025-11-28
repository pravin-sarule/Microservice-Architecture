/**
 * Imagen Service - The "Artist"
 * Uses Vertex AI Imagen 3 to generate high-quality infographic images
 * with superior text rendering capabilities
 */
const axios = require('axios');

class ImagenService {
  constructor() {
    // Get configuration from environment variables
    this.projectId = process.env.GCP_PROJECT_ID;
    this.location = process.env.GCP_LOCATION || 'us-central1';
    this.vertexAI = null;
    
    if (!this.projectId) {
      console.warn('⚠️ Warning: GCP_PROJECT_ID not found. Image generation will not work.');
    } else {
      // Vertex AI will be initialized via REST API calls
      console.log(`[ImagenService] ✅ Initialized with project: ${this.projectId}, location: ${this.location}`);
    }
  }
  
  /**
   * Generate infographic image using Imagen 3
   * 
   * @param {string} prompt - The image generation prompt from Gemini
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated image data with URL or base64
   */
  async generateImage(prompt, options = {}) {
    if (!this.projectId) {
      throw new Error('Vertex AI not configured. GCP_PROJECT_ID and credentials are required.');
    }
    
    const {
      aspectRatio = '16:9', // Landscape for infographics
      safetyFilter = 'block_some', // block_some, block_few, block_most, block_none
      seed = null,
    } = options;
    
    try {
      console.log('[ImagenService] Generating image with Imagen 3...');
      console.log(`[ImagenService] Prompt length: ${prompt.length} characters`);
      
      // Use the Imagen 3 model endpoint
      const model = 'imagegeneration@006'; // Imagen 3 - critical for text rendering
      
      // Construct the request
      const request = {
        instances: [
          {
            prompt: prompt,
          }
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio,
          safetyFilterLevel: safetyFilter,
          personGeneration: 'allow_all', // Allow all person generation
          negativePrompt: 'blurry, low quality, distorted text, unreadable text, watermark, signature',
        }
      };
      
      // Add seed if provided
      if (seed) {
        request.parameters.seed = seed;
      }
      
      // Call Vertex AI Image Generation API
      const endpoint = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model}:predict`;
      
      // For Vertex AI, we need to use the REST API or SDK
      // Using REST API approach
      const accessToken = await this.getAccessToken();
      
      const response = await axios.post(
        `https://${this.location}-aiplatform.googleapis.com/v1/${endpoint}`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 seconds timeout for image generation
        }
      );
      
      if (response.data && response.data.predictions && response.data.predictions.length > 0) {
        const prediction = response.data.predictions[0];
        
        // Imagen returns base64 encoded image
        const imageBase64 = prediction.bytesBase64Encoded || prediction.bytes_base64_encoded;
        
        if (!imageBase64) {
          throw new Error('No image data in response');
        }
        
        console.log('[ImagenService] ✅ Image generated successfully');
        
        return {
          imageBase64: imageBase64,
          mimeType: 'image/png',
          prompt: prompt,
        };
      } else {
        throw new Error('Invalid response from Imagen API');
      }
      
    } catch (error) {
      console.error('[ImagenService] ❌ Error generating image:', error.message);
      
      if (error.response) {
        console.error('[ImagenService] API Error Response:', error.response.data);
        throw new Error(`Imagen API error: ${error.response.data.error?.message || error.message}`);
      }
      
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }
  
  /**
   * Get access token for Vertex AI API
   * Uses Application Default Credentials
   * 
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    try {
      // Try using Google Auth Library
      const { GoogleAuth } = require('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();
      
      return accessToken.token || accessToken;
    } catch (error) {
      console.error('[ImagenService] Error getting access token:', error.message);
      
      // Fallback: Check if GOOGLE_APPLICATION_CREDENTIALS is set
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('Google Application Credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable or use Application Default Credentials.');
      }
      
      throw error;
    }
  }
  
  /**
   * Convert base64 image to data URL for frontend
   * 
   * @param {string} base64Image - Base64 encoded image
   * @param {string} mimeType - MIME type (default: image/png)
   * @returns {string} Data URL
   */
  static base64ToDataURL(base64Image, mimeType = 'image/png') {
    return `data:${mimeType};base64,${base64Image}`;
  }
}

// Export singleton instance
module.exports = new ImagenService();

