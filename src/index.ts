import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import Ainize from '@ainize-team/ainize-sdk'
import { RESPONSE_STATUS } from '@ainize-team/ainize-sdk/dist/types/type';
import { checkParams } from './functions/service';
import Queue from './queue';
dotenv.config();
const userPrivateKey = process.env.PRIVATE_KEY? process.env.PRIVATE_KEY : '';
const app: Express = express();
app.use(express.json());
const port = process.env.PORT;
const ainize = new Ainize(0);
ainize.login(userPrivateKey);
const queue = new Queue();
let count = 0;
app.post('/response', async (req: Request, res: Response) => {
  console.log('count :>> ', ++count);
  const responseData = req.body;
  const data = queue.finish();
  if (!data) {
    return res.send("Queue is empty.");
  }
  if(responseData.results) {
    console.log('responseData:', responseData.results);
    await ainize.internal.handleRequest(data.req, data.amount, RESPONSE_STATUS.SUCCESS, responseData.results);
    return res.send("Response success.");
  } else {
    console.log('responseData:', responseData);
    await ainize.internal.handleRequest(data.req, data.amount, RESPONSE_STATUS.FAIL, responseData);
    return res.send("Response failed.");
  }
});

app.post(
  '/service', 
  ainize.middleware.triggerDuplicateFilter, 
  async (req: Request, res: Response) => {
    console.log('service');
    const { requesterAddress, appName, requestData, requestKey } = ainize.internal.getDataFromServiceRequest(req);
    if (!checkParams(requestData)) throw Error("Invalid parameters");
    try {
      const service = await ainize.getService(appName);
      const amount = await service.calculateCost('');
      queue.push({ requestData, requesterAddress, requestKey, appName, req, amount });
    } catch(e) {
      await ainize.internal.handleRequest(req, 0, RESPONSE_STATUS.FAIL, 'error');
      console.log('error: index:43');
      res.send('error');
    }
  }
);

app.post(
  '/deposit', 
  ainize.middleware.triggerDuplicateFilter, 
  async (req: Request, res:Response) => {
    console.log("deposit");
    try { 
      const result = await ainize.internal.handleDeposit(req);
      console.log(result);
    } catch(e) {
      console.log('error: ', e);
      res.send('error');
    }
  }
);

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});