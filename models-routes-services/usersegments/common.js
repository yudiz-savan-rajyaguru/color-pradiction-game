function getKycStatus(eStatus) {
  switch (eStatus) {
    case 'A':
      eStatus = 'Accepted'
      break
    case 'P':
      eStatus = 'Pending'
      break
    case 'R':
      eStatus = 'Rejected'
      break
    case 'N':
      eStatus = 'Not uploaded'
      break

    default:
      eStatus = 'Pending'
      break
  }
  return eStatus
}

module.exports = {
  getKycStatus
}
