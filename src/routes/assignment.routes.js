import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listAssignments,
  createAssignments,
  deleteAssignment,
  getAssignmentMatrix,
  updateAssignmentMatrix,
  deleteAssignmentMatrix,
} from '../controllers/assignment.controller.js';

const router = Router();

router.get('/', asyncHandler(listAssignments));
router.post('/', asyncHandler(createAssignments));
router.get('/matrix/:id', asyncHandler(getAssignmentMatrix));
router.put('/matrix/:id', asyncHandler(updateAssignmentMatrix));
router.delete('/matrix/:id', asyncHandler(deleteAssignmentMatrix));
router.delete('/:id', asyncHandler(deleteAssignment));

export default router;
