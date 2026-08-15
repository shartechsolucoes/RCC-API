import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  profileLevel?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: "Token ausente" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      sub: string;
      profileLevel: string;
    };
    req.userId = payload.sub;
    req.profileLevel = payload.profileLevel;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      sub: string;
      profileLevel: string;
    };
    req.userId = payload.sub;
    req.profileLevel = payload.profileLevel;
  } catch {
    // invalid/expired token on an optional route: proceed unauthenticated
  }
  next();
}

export function requireProfile(...allowed: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.profileLevel || !allowed.includes(req.profileLevel)) {
      return res.status(403).json({ message: "Acesso não permitido" });
    }
    next();
  };
}
