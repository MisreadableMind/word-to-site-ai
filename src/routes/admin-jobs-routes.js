import { Router } from 'express';

export default function createAdminJobsRouter(jobsService) {
  const router = Router();

  router.post('/daily', async (req, res) => {
    try {
      const result = await jobsService.runDaily();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Daily job error:', error);
      res.status(500).json({ error: { message: error.message || 'Daily job failed', type: 'server_error' } });
    }
  });

  router.post('/expire-free', async (req, res) => {
    try {
      const result = await jobsService.expireFreeSites();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Expire-free job error:', error);
      res.status(500).json({ error: { message: error.message || 'Job failed', type: 'server_error' } });
    }
  });

  router.post('/accrue-overage', async (req, res) => {
    try {
      const result = await jobsService.accrueOverage();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Accrue-overage job error:', error);
      res.status(500).json({ error: { message: error.message || 'Job failed', type: 'server_error' } });
    }
  });

  return router;
}
