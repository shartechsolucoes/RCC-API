import path from "node:path";

import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { errorHandler } from "./common/middlewares/error.middleware";
import authRoutes from "./modules/auth/auth.routes";
import calendarRoutes from "./modules/calendar/calendar.routes";
import companiesRoutes from "./modules/companies/companies.routes";
import eventsRoutes from "./modules/events/events.routes";
import financialRoutes from "./modules/financial/financial.routes";
import galleriesRoutes from "./modules/galleries/galleries.routes";
import groupsRoutes from "./modules/groups/groups.routes";
import invitationsRoutes from "./modules/invitations/invitations.routes";
import membersRoutes from "./modules/members/members.routes";
import ministriesRoutes from "./modules/ministries/ministries.routes";
import missionsRoutes from "./modules/missions/missions.routes";
import muralRoutes from "./modules/mural/mural.routes";
import newsRoutes from "./modules/news/news.routes";
import registrationsRoutes from "./modules/registrations/registrations.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import uploadsRoutes from "./modules/uploads/uploads.routes";
import usersRoutes from "./modules/users/users.routes";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "").split(",").filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/members", membersRoutes);
app.use("/events", eventsRoutes);
app.use("/missions", missionsRoutes);
app.use("/ministries", ministriesRoutes);
app.use("/registrations", registrationsRoutes);
app.use("/users", usersRoutes);
app.use("/news", newsRoutes);
app.use("/companies", companiesRoutes);
app.use("/galleries", galleriesRoutes);
app.use("/groups", groupsRoutes);
app.use("/invitations", invitationsRoutes);
app.use("/financial-transactions", financialRoutes);
app.use("/reports", reportsRoutes);
app.use("/uploads", uploadsRoutes);
app.use("/mural", muralRoutes);
app.use("/calendar", calendarRoutes);

app.use(errorHandler);

const port = process.env.PORT ? Number(process.env.PORT) : 3333;

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
