import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../controllers/location.controller.js';

const router = Router();

router.get('/', asyncHandler(listLocations));
router.get('/:id', asyncHandler(getLocation));
router.post('/', asyncHandler(createLocation));
router.put('/:id', asyncHandler(updateLocation));
router.delete('/:id', asyncHandler(deleteLocation));

export default router;
