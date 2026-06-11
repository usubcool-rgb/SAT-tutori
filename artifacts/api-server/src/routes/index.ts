import { Router, type IRouter } from "express";
import healthRouter from "./health";
import questionsRouter from "./questions";
import progressRouter from "./progress";
import statsRouter from "./stats";
import explainRouter from "./explain";

const router: IRouter = Router();

router.use(healthRouter);
router.use(questionsRouter);
router.use(progressRouter);
router.use(statsRouter);
router.use(explainRouter);

export default router;
