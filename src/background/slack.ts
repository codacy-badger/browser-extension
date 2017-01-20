'use strict'

import axios from 'axios'
import * as cheerio from 'cheerio'
import * as v from 'voca'

export interface Team {
  name: string;
  teamdomain: string;
}

export async function searchJoinedTeams() : Promise<Team[]> {
  const res = await axios.get('https://slack.com/customize/emoji')
  if (_DEBUG) {
    console.log(res)
  }

  const $ = cheerio.load(res.data)
  const teamAnchors = $('#header_team_nav li:not(#add_team_option) a').toArray()
  const teams: Team[] = teamAnchors
    .map(_anchor => {
      const anchor  = $(_anchor)
      const href    = anchor.attr('href')
      const matches = href.match(/\/\/([^\.]+)\.slack\.com/)

      if (matches) {
        return {
          name: v.trim(anchor.text()),
          teamdomain: matches[1],
        }
      }
    })
    .filter(team => !!team)

  if (_DEBUG) {
    console.log('teams', teams)
  }
  return teams
}

export async function registerEmoji(
  url: string,
  text: string,
  teamdomain: string
  ) : Promise<string>
{
  if (!url) { throw 'Invalid Emoji URL' }

  // fetch emoji image data
  const image = await axios.get(url, { responseType: 'blob' })
  if (_DEBUG) { console.log(image) }

  // fetch initial form data
  const actionUrl = `https://${teamdomain}.slack.com/customize/emoji`
  const customize = await axios.get(actionUrl)
  if (_DEBUG) { console.log(customize) }

  let $ = cheerio.load(customize.data)
  const form  = $('#addemoji')
  const pairs = form.serializeArray()
  if (_DEBUG) { console.log(pairs) }

  // create post form data
  const fd = new FormData()
  pairs.forEach(pair => {
    if (pair.name === 'name') {
      fd.append(pair.name, text + 'xxxx')
    } else {
      fd.append(pair.name, pair.value)
    }
  })
  fd.append('img', image.data)

  // submit
  const headers = { 'Content-Type': 'multipart/form-data' }
  const result  = await axios.post(actionUrl, fd, { headers })
  if (_DEBUG) { console.log(result) }

  // parse result message
  $ = cheerio.load(result.data)
  const alertElement = $('.alert:first-of-type')
  const messages     = alertElement.text()
    .split('\n')
    .map(message => v.trim(message))
    .filter(message => message.length > 0)
  if (_DEBUG) {
    console.log(messages)
  }

  if (alertElement.hasClass('alert-success') && messages.length > 0) {
    return messages[0]
  }

  throw messages[0] || 'Unknown Error'
}