import React from 'react';
import { useParams } from 'react-router-dom';
import { PortfolioFooter } from '../portfolio/PortfolioFooter';

export const DashboardFooterStatus: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  return <PortfolioFooter companySlug={companySlug} activeLink="dashboard" />;
};
