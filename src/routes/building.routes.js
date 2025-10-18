import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listBuildings,
  getBuilding,
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from '../controllers/building.controller.js';

const router = Router();

router.get('/', asyncHandler(listBuildings));
router.get('/:id', asyncHandler(getBuilding));
router.post('/', asyncHandler(createBuilding));
router.put('/:id', asyncHandler(updateBuilding));
router.delete('/:id', asyncHandler(deleteBuilding));

export default router;
