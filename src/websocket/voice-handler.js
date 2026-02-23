/**
 * WebSocket Voice Handler
 * Handles real-time voice streaming for interview flow
 */

import { WebSocketServer } from 'ws';
import VoiceService from '../services/voice-service.js';
import AIService from '../services/ai-service.js';
import OnboardingWorkflow from '../onboarding-workflow.js';
import { INTERVIEW_QUESTIONS } from '../constants.js';

/**
 * Message types for WebSocket communication
 */
export const MessageTypes = {
  // Client -> Server
  AUDIO_CHUNK: 'audio_chunk',
  START_RECORDING: 'start_recording',
  STOP_RECORDING: 'stop_recording',
  SUBMIT_ANSWER: 'submit_answer',
  REQUEST_QUESTION: 'request_question',
  COMPLETE_INTERVIEW: 'complete_interview',

  // Server -> Client
  TRANSCRIPT: 'transcript',
  AI_QUESTION: 'ai_question',
  INTERVIEW_PROGRESS: 'interview_progress',
  INTERVIEW_COMPLETE: 'interview_complete',
  ERROR: 'error',
  READY: 'ready',
};

class VoiceHandler {
  constructor(options = {}) {
    this.aiService = new AIService();
    this.voiceService = new VoiceService({ aiService: this.aiService });
    this.sessions = new Map(); // Track active interview sessions
    this.port = options.port || 3001;
    this.wss = null;
  }

  /**
   * Initialize WebSocket server
   * @param {Object} server - HTTP server to attach to (optional)
   * @returns {WebSocketServer} WebSocket server instance
   */
  initialize(server = null) {
    const wsOptions = server
      ? { server, path: '/ws/voice' }
      : { port: this.port };

    this.wss = new WebSocketServer(wsOptions);

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log(`Voice WebSocket handler initialized${server ? ' on /ws/voice' : ` on port ${this.port}`}`);

    return this.wss;
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} req - HTTP request
   */
  handleConnection(ws, req) {
    const sessionId = this.generateSessionId();

    // Initialize session
    this.sessions.set(sessionId, {
      ws,
      answers: [],
      currentQuestionIndex: 0,
      audioBuffer: [],
      isRecording: false,
      language: 'auto',
    });

    console.log(`New voice session: ${sessionId}`);

    // Send ready message with session ID and first question
    this.send(ws, MessageTypes.READY, {
      sessionId,
      totalQuestions: INTERVIEW_QUESTIONS.length,
    });

    // Send first question
    this.sendQuestion(ws, sessionId, 0);

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(ws, sessionId, data);
    });

    // Handle close
    ws.on('close', () => {
      console.log(`Voice session closed: ${sessionId}`);
      this.sessions.delete(sessionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`Voice session error: ${sessionId}`, error.message);
      this.sessions.delete(sessionId);
    });
  }

  /**
   * Handle incoming WebSocket message
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} sessionId - Session ID
   * @param {Buffer|string} data - Message data
   */
  async handleMessage(ws, sessionId, data) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      this.send(ws, MessageTypes.ERROR, { error: 'Session not found' });
      return;
    }

    try {
      // Check if binary audio data
      if (Buffer.isBuffer(data)) {
        await this.handleAudioChunk(ws, session, data);
        return;
      }

      // Parse JSON message
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case MessageTypes.AUDIO_CHUNK:
          // Base64 encoded audio
          const audioBuffer = Buffer.from(message.data, 'base64');
          await this.handleAudioChunk(ws, session, audioBuffer);
          break;

        case MessageTypes.START_RECORDING:
          session.isRecording = true;
          session.audioBuffer = [];
          break;

        case MessageTypes.STOP_RECORDING:
          session.isRecording = false;
          await this.processRecording(ws, session, sessionId);
          break;

        case MessageTypes.SUBMIT_ANSWER:
          await this.handleSubmitAnswer(ws, session, sessionId, message.answer);
          break;

        case MessageTypes.REQUEST_QUESTION:
          this.sendQuestion(ws, sessionId, session.currentQuestionIndex);
          break;

        case MessageTypes.COMPLETE_INTERVIEW:
          await this.handleCompleteInterview(ws, session, sessionId);
          break;

        default:
          this.send(ws, MessageTypes.ERROR, { error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error('Message handling error:', error.message);
      this.send(ws, MessageTypes.ERROR, { error: error.message });
    }
  }

  /**
   * Handle incoming audio chunk
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} session - Session data
   * @param {Buffer} chunk - Audio chunk
   */
  async handleAudioChunk(ws, session, chunk) {
    if (session.isRecording) {
      session.audioBuffer.push(chunk);
    }
  }

  /**
   * Process completed recording
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} session - Session data
   * @param {string} sessionId - Session ID
   */
  async processRecording(ws, session, sessionId) {
    if (session.audioBuffer.length === 0) {
      return;
    }

    try {
      // Combine audio chunks
      const fullAudio = Buffer.concat(session.audioBuffer);
      session.audioBuffer = [];

      // Transcribe
      const transcription = await this.voiceService.transcribe(fullAudio, session.language);

      // Send transcript to client
      this.send(ws, MessageTypes.TRANSCRIPT, {
        text: transcription.text,
        language: transcription.language,
        questionIndex: session.currentQuestionIndex,
      });

      // Auto-submit as answer if we have a transcript
      if (transcription.text && transcription.text.length > 0) {
        await this.handleSubmitAnswer(ws, session, sessionId, transcription.text);
      }
    } catch (error) {
      console.error('Transcription error:', error.message);
      this.send(ws, MessageTypes.ERROR, {
        error: 'Failed to transcribe audio',
        details: error.message,
      });
    }
  }

  /**
   * Handle submitted answer
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} session - Session data
   * @param {string} sessionId - Session ID
   * @param {string} answer - Answer text
   */
  async handleSubmitAnswer(ws, session, sessionId, answer) {
    const currentQuestion = INTERVIEW_QUESTIONS[session.currentQuestionIndex];

    if (!currentQuestion) {
      // All questions answered
      await this.handleCompleteInterview(ws, session, sessionId);
      return;
    }

    // Store answer
    session.answers.push({
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      answer,
      timestamp: new Date().toISOString(),
    });

    // Send progress update
    this.send(ws, MessageTypes.INTERVIEW_PROGRESS, {
      answered: session.answers.length,
      total: INTERVIEW_QUESTIONS.length,
      percentage: Math.round((session.answers.length / INTERVIEW_QUESTIONS.length) * 100),
    });

    // Move to next question
    session.currentQuestionIndex++;

    if (session.currentQuestionIndex < INTERVIEW_QUESTIONS.length) {
      // Get next question (possibly AI-enhanced)
      await this.sendNextQuestion(ws, session, sessionId);
    } else {
      // Interview complete
      await this.handleCompleteInterview(ws, session, sessionId);
    }
  }

  /**
   * Send a question to the client
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} sessionId - Session ID
   * @param {number} index - Question index
   */
  sendQuestion(ws, sessionId, index) {
    const question = INTERVIEW_QUESTIONS[index];

    if (!question) {
      return;
    }

    this.send(ws, MessageTypes.AI_QUESTION, {
      questionId: question.id,
      question: question.question,
      context: question.context,
      index,
      total: INTERVIEW_QUESTIONS.length,
    });
  }

  /**
   * Send next question with optional AI enhancement
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} session - Session data
   * @param {string} sessionId - Session ID
   */
  async sendNextQuestion(ws, session, sessionId) {
    try {
      // Try to get AI-enhanced next question
      const nextQuestion = await this.voiceService.getNextQuestion(
        {},
        session.answers
      );

      if (nextQuestion.complete) {
        await this.handleCompleteInterview(ws, session, sessionId);
        return;
      }

      // Check if we have a predefined question or a follow-up
      const questionData = INTERVIEW_QUESTIONS.find(q => q.id === nextQuestion.questionId);

      this.send(ws, MessageTypes.AI_QUESTION, {
        questionId: nextQuestion.questionId,
        question: nextQuestion.question || questionData?.question,
        context: nextQuestion.context || questionData?.context,
        suggestions: nextQuestion.suggestions || [],
        index: session.currentQuestionIndex,
        total: INTERVIEW_QUESTIONS.length,
        completionPercentage: nextQuestion.completionPercentage,
      });

      // Optionally synthesize question as speech
      if (this.aiService.hasOpenAI) {
        try {
          const questionText = nextQuestion.question || questionData?.question;
          const audioBuffer = await this.voiceService.synthesize(questionText);

          this.send(ws, MessageTypes.AI_QUESTION, {
            audio: audioBuffer.toString('base64'),
            format: 'mp3',
          });
        } catch {
          // Audio synthesis failed, text already sent
        }
      }
    } catch (error) {
      console.warn('AI question enhancement failed:', error.message);
      // Fall back to predefined question
      this.sendQuestion(ws, sessionId, session.currentQuestionIndex);
    }
  }

  /**
   * Handle interview completion
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} session - Session data
   * @param {string} sessionId - Session ID
   */
  async handleCompleteInterview(ws, session, sessionId) {
    try {
      // Convert answers to the format expected by OnboardingWorkflow
      const answersMap = {};
      session.answers.forEach(qa => {
        answersMap[qa.questionId] = qa.answer;
      });

      // Execute Flow B with the answers
      const workflow = new OnboardingWorkflow({
        onProgress: (progress) => {
          this.send(ws, MessageTypes.INTERVIEW_PROGRESS, progress);
        },
      });

      const result = await workflow.executeFlowB(answersMap, {
        language: session.language,
      });

      // Send complete result
      this.send(ws, MessageTypes.INTERVIEW_COMPLETE, {
        success: result.success,
        deploymentContext: result.deploymentContext,
        contentContext: result.contentContext,
        templateMatch: result.templateMatch,
        answers: answersMap,
        error: result.error,
      });
    } catch (error) {
      console.error('Interview completion error:', error.message);
      this.send(ws, MessageTypes.ERROR, {
        error: 'Failed to complete interview',
        details: error.message,
      });
    }
  }

  /**
   * Send message to WebSocket client
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  send(ws, type, data) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify({ type, ...data }));
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close the WebSocket server
   */
  close() {
    if (this.wss) {
      this.wss.close();
      this.sessions.clear();
      console.log('Voice WebSocket handler closed');
    }
  }
}

export default VoiceHandler;
