const net = require('net')

function validateAndDetectIPRange(ipRange) {
  const [ip, subnet] = ipRange.split('/')

  const ipType = net.isIP(ip) // Determine if it's IPv4 or IPv6

  // Validate IPv4
  if (ipType === 4) {
    const subnetInt = subnet ? Number(subnet, 10) : 32

    if (subnetInt < 0 || subnetInt > 32) {
      return {
        isValid: false,
        ipType: null,
        input: ipRange,
        message: 'Invalid IP or range'
      }
    }

    if (!subnet) {
      // Attach default subnet 32 if missing or invalid
      return {
        isValid: true,
        ipType: 'IPv4',
        input: `${ip}/32`,
        message: 'Defaulted to /32 subnet for IPv4'
      }
    }

    // Valid IPv4 range or IP
    return {
      isValid: true,
      ipType: 'IPv4',
      input: `${ip}/${subnetInt}`
    }
  }

  // Validate IPv6
  if (ipType === 6) {
    const subnetInt = subnet ? Number(subnet) : 128

    if (subnetInt < 0 || subnetInt > 128) {
      return {
        isValid: false,
        ipType: null,
        input: ipRange,
        message: 'Invalid IP or range'
      }
    }

    if (!subnet) {
      // Attach default subnet 128 if missing or invalid
      return {
        isValid: true,
        ipType: 'IPv6',
        input: `${ip}/128`,
        message: 'Defaulted to /128 subnet for IPv6'
      }
    }

    // Valid IPv6 range or IP
    return {
      isValid: true,
      ipType: 'IPv6',
      input: `${ip}/${subnetInt}`
    }
  }

  // If IP is invalid
  return {
    isValid: false,
    ipType: null,
    input: ipRange,
    message: 'Invalid IP or range'
  }
}

module.exports = {
  validateAndDetectIPRange
}
