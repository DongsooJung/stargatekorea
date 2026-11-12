// Add only the owner's approved tracking links. Empty values use regular links.
// Changing a URL never turns it into an affiliate link without explicit approval.
export default {
  affiliateLinks: {
    airport: { approved: false, url: '' },
    connectivity: { approved: false, url: '' },
    stays: { approved: false, url: '' },
    experiences: { approved: false, url: '' },
  },
};
