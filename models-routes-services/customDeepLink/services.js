// @ts-check
const path = require('path')
const fs = require('fs')
const { catchError } = require('../../helper/utilities.services')
const { status, jsonStatus } = require('../../helper/api.responses')
const config = require('../../config/config')
const DeepLinksModel = require('./model')
const { DYNAMIC_LINK_ANDROID_PACKAGE_NAME, IOS_APP_STORE_ID, APP_NAME, CUSTOM_SCHEME } = require('../../config/common')
const { messages } = require('../../helper/api.responses')

class CustomFile {
  async iosFile(req, res) {
    try {
      res.setHeader('Content-Type', 'application/json')
      const file = fs.readFileSync(path.join(__dirname, '../../apple-app-site-association'))
      return res.status(status.OK).json(JSON.parse(file))
    } catch (error) {
      return catchError('CustomFile.iosFile', error, req, res)
    }
  }

  async openDeepLink(req, res) {
    try {
      const { code } = req.params
      const deepLink = await DeepLinksModel.findOne({ sCode: code }).lean()

      const renderData = {
        code,
        webLink: deepLink?.sWebLink || config.FRONTEND_HOST_URL,
        backendEndHostUrl: config.BACKEND_URL,
        dynamicLinkAndroidPackageName: DYNAMIC_LINK_ANDROID_PACKAGE_NAME,
        iosAppStoreId: IOS_APP_STORE_ID,
        appName: APP_NAME,
        customScheme: CUSTOM_SCHEME
      }

      await DeepLinksModel.updateOne({ sCode: code }, { $inc: { nTotalClicks: 1 } })

      return res.render('deeplink.ejs', renderData)
    } catch (error) {
      return catchError('CustomFile.openDeepLink', error, req, res)
    }
  }

  async getLinkData(req, res) {
    try {
      const { sLink } = req.query
      const link = await DeepLinksModel.findOne({ sDeepLink: sLink }, { dCreatedAt: 0, dUpdatedAt: 0, __v: 0 }).lean()
      if (!link) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', 'Link') })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', 'Link data'), data: link })
    } catch (error) {
      return catchError('OrgUserContest.getLinkData', error, req, res)
    }
  }
}

module.exports = new CustomFile()
