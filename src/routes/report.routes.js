import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { getAssignmentsReport } from '../controllers/report.controller.js';

const router = Router();

router.get('/assignments', asyncHandler(getAssignmentsReport));

export default router;
