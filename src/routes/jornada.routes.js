import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listJornadas,
  getJornada,
  createJornada,
  updateJornada,
  deleteJornada,
} from '../controllers/jornada.controller.js';

const router = Router();

router.get('/', asyncHandler(listJornadas));
router.get('/:id', asyncHandler(getJornada));
router.post('/', asyncHandler(createJornada));
router.put('/:id', asyncHandler(updateJornada));
router.delete('/:id', asyncHandler(deleteJornada));

export default router;
