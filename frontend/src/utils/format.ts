export const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount / 100);
};

export const truncateId = (id: string) => {
  if (!id) return '';
  return id.length > 8 ? id.substring(0, 8) + '...' : id;
};
