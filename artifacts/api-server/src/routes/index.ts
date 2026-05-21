import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import zonesRouter from "./zones";
import usersRouter from "./users";
import ordersRouter from "./orders";
import ratingsRouter from "./ratings";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import customerRouter from "./customer";
import featuresRouter from "./features";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(zonesRouter);
router.use(usersRouter);
router.use(ordersRouter);
router.use(customerRouter);
router.use(ratingsRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(featuresRouter);

export default router;
