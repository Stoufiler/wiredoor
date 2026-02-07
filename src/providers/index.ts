import db from './db';
import initializer from './initializer';
import expressProvider from './express';
import express from 'express';
import dns from './dns';
import { startDomainRefresh } from './domain-refresh';

export default async (expressApp: express.Application): Promise<void> => {
  await db();

  await dns();

  await initializer();

  expressProvider({ app: expressApp });

  if (process.env.NODE_ENV !== 'test') {
    startDomainRefresh();
  }
};
