import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listTimeSlots,
  getTimeSlot,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
} from '../controllers/timeSlot.controller.js';

const router = Router();

router.get('/', asyncHandler(listTimeSlots));
router.get('/:id', asyncHandler(getTimeSlot));
router.post('/', asyncHandler(createTimeSlot));
router.put('/:id', asyncHandler(updateTimeSlot));
router.delete('/:id', asyncHandler(deleteTimeSlot));

export default router;
