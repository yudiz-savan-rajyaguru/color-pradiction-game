const oXpKey = {}

oXpKey.getUpdateUserXpKey = ({ iUserId }) => `OT:EVENT:XP:${iUserId}:UPDATE`

module.exports = oXpKey
