/**
 * Infographic Controller
 * Handles HTTP requests for infographic generation
 * Orchestrates the two-step process: Architect (Gemini) -> Artist (Imagen)
 */
const { v4: uuidv4 } = require('uuid');
const DocumentService = require('../services/documentService');
const ContentProcessor = require('../services/contentProcessor');
const GeminiService = require('../services/geminiService');
const ImagenService = require('../services/imagenService');
const { createJob, updateJob, getJob } = require('../utils/jobManager');

class InfographicController {
  /**
   * Generate infographic from a single document
   * POST /api/infographic/generate
   * 
   * Request body:
   * {
   *   "file_id": "uuid",
   *   "prompt": "optional custom prompt"
   * }
   */
  static async generateInfographic(req, res) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const { file_id, prompt } = req.body;
      
      if (!file_id) {
        return res.status(400).json({ error: 'file_id is required' });
      }
      
      console.log(`[InfographicController] Generate request - file_id: ${file_id}, user_id: ${userId}`);
      
      // Get authorization token
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header is required' });
      }
      
      // Create async job
      const jobId = uuidv4();
      createJob(jobId, {
        userId,
        fileId: file_id,
        status: 'pending',
        step: 'Initializing...'
      });
      
      // Start async processing (don't await)
      InfographicController.processInfographicGeneration(jobId, file_id, authHeader, userId, prompt)
        .catch(error => {
          console.error(`[InfographicController] Job ${jobId} failed:`, error.message);
          updateJob(jobId, {
            status: 'failed',
            step: 'Generation failed',
            error: error.message
          });
        });
      
      // Return job ID immediately
      return res.status(202).json({
        success: true,
        job_id: jobId,
        status: 'pending',
        message: 'Infographic generation started'
      });
      
    } catch (error) {
      console.error('[InfographicController] Error:', error.message);
      return res.status(500).json({
        error: 'Failed to start infographic generation',
        details: error.message
      });
    }
  }
  
  /**
   * Get job status
   * GET /api/infographic/status/:job_id
   */
  static async getJobStatus(req, res) {
    try {
      const { job_id } = req.params;
      const userId = req.user?.id || req.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const job = getJob(job_id);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Verify job belongs to user
      if (job.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      return res.json({
        success: true,
        job_id,
        status: job.status,
        step: job.step,
        progress: job.progress,
        image_url: job.imageUrl || null,
        image_base64: job.imageBase64 || null,
        prompt: job.prompt || null,
        error: job.error || null,
        created_at: job.createdAt,
        updated_at: job.updatedAt
      });
      
    } catch (error) {
      console.error('[InfographicController] Error getting status:', error.message);
      return res.status(500).json({
        error: 'Failed to get job status',
        details: error.message
      });
    }
  }
  
  /**
   * Process infographic generation asynchronously
   * This runs in the background and updates job status
   * 
   * @private
   */
  static async processInfographicGeneration(jobId, fileId, authHeader, userId, customPrompt) {
    try {
      // Step 1: Fetch document data
      updateJob(jobId, {
        status: 'processing',
        step: 'Fetching document from Document Service...',
        progress: 10
      });
      
      const documentData = await DocumentService.getFileComplete(fileId, authHeader);
      
      if (!documentData || !documentData.success) {
        throw new Error('Document not found or access denied');
      }
      
      // Step 2: Extract document content
      updateJob(jobId, {
        step: 'Extracting document content...',
        progress: 20
      });
      
      const documentContent = ContentProcessor.extractDocumentContent(documentData);
      
      if (!documentContent || documentContent.trim().length === 0) {
        throw new Error('Document has no extractable content');
      }
      
      // Step 3: Generate image prompt using Gemini (Architect)
      updateJob(jobId, {
        status: 'analyzing',
        step: 'Analyzing legal document with AI...',
        progress: 30
      });
      
      const imagePrompt = await GeminiService.generateImagePrompt(documentContent);
      
      updateJob(jobId, {
        step: 'Image prompt generated. Designing visualization...',
        progress: 50,
        prompt: imagePrompt
      });
      
      // Step 4: Generate image using Imagen (Artist)
      updateJob(jobId, {
        status: 'designing',
        step: 'Generating infographic image...',
        progress: 60
      });
      
      const imageResult = await ImagenService.generateImage(imagePrompt, {
        aspectRatio: '16:9',
        safetyFilter: 'block_some'
      });
      
      // Step 5: Convert to data URL
      const imageDataURL = ImagenService.base64ToDataURL(
        imageResult.imageBase64,
        imageResult.mimeType
      );
      
      // Step 6: Update job with completed status
      updateJob(jobId, {
        status: 'completed',
        step: 'Infographic generated successfully!',
        progress: 100,
        imageBase64: imageResult.imageBase64,
        imageUrl: imageDataURL,
        mimeType: imageResult.mimeType
      });
      
      console.log(`[InfographicController] ✅ Job ${jobId} completed successfully`);
      
    } catch (error) {
      console.error(`[InfographicController] Job ${jobId} error:`, error.message);
      
      updateJob(jobId, {
        status: 'failed',
        step: `Error: ${error.message}`,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Generate infographic synchronously (for testing or simple use cases)
   * POST /api/infographic/generate-sync
   * 
   * Note: This will take 15-30 seconds, so use async endpoint for production
   */
  static async generateInfographicSync(req, res) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const { file_id, prompt } = req.body;
      
      if (!file_id) {
        return res.status(400).json({ error: 'file_id is required' });
      }
      
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header is required' });
      }
      
      // Step 1: Fetch document
      res.json({ type: 'status', step: 'Fetching document...', progress: 10 });
      
      const documentData = await DocumentService.getFileComplete(file_id, authHeader);
      
      // Step 2: Extract content
      res.json({ type: 'status', step: 'Processing content...', progress: 30 });
      
      const documentContent = ContentProcessor.extractDocumentContent(documentData);
      
      // Step 3: Generate prompt
      res.json({ type: 'status', step: 'Analyzing with AI...', progress: 50 });
      
      const imagePrompt = await GeminiService.generateImagePrompt(documentContent);
      
      // Step 4: Generate image
      res.json({ type: 'status', step: 'Generating image...', progress: 70 });
      
      const imageResult = await ImagenService.generateImage(imagePrompt, {
        aspectRatio: '16:9',
        safetyFilter: 'block_some'
      });
      
      const imageDataURL = ImagenService.base64ToDataURL(
        imageResult.imageBase64,
        imageResult.mimeType
      );
      
      // Step 5: Return final result
      return res.json({
        type: 'final',
        success: true,
        file_id,
        document_name: documentData.file?.originalname || '',
        image_url: imageDataURL,
        image_base64: imageResult.imageBase64,
        prompt: imagePrompt,
        generated_at: new Date().toISOString(),
        user_id: userId
      });
      
    } catch (error) {
      console.error('[InfographicController] Error:', error.message);
      return res.status(500).json({
        type: 'final',
        error: 'Failed to generate infographic',
        details: error.message
      });
    }
  }
}

module.exports = InfographicController;



