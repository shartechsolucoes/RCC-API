import type { Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

const createGallerySchema = z.object({
  title: z.string().min(2),
  eventId: z.string().optional(),
});

const addPhotoSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
});

export async function list(_req: Request, res: Response) {
  const galleries = await prisma.gallery.findMany({
    include: { photos: true },
    orderBy: { id: "desc" },
  });
  res.json(galleries);
}

export async function create(req: Request, res: Response) {
  const parsed = createGallerySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const gallery = await prisma.gallery.create({ data: parsed.data });
  res.status(201).json(gallery);
}

export async function remove(req: Request, res: Response) {
  const gallery = await prisma.gallery.findUnique({ where: { id: req.params.id } });
  if (!gallery) {
    return res.status(404).json({ message: "Galeria não encontrada" });
  }
  await prisma.gallery.delete({ where: { id: gallery.id } });
  res.status(204).send();
}

export async function addPhoto(req: Request, res: Response) {
  const parsed = addPhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.issues });
  }

  const gallery = await prisma.gallery.findUnique({ where: { id: req.params.id } });
  if (!gallery) {
    return res.status(404).json({ message: "Galeria não encontrada" });
  }

  const photo = await prisma.galleryPhoto.create({
    data: { ...parsed.data, galleryId: gallery.id },
  });
  res.status(201).json(photo);
}

export async function removePhoto(req: Request, res: Response) {
  const photo = await prisma.galleryPhoto.findUnique({ where: { id: req.params.photoId } });
  if (!photo) {
    return res.status(404).json({ message: "Foto não encontrada" });
  }
  await prisma.galleryPhoto.delete({ where: { id: photo.id } });
  res.status(204).send();
}
