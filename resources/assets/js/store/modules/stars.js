import qs from 'qs'
import {
  CLEAR_STARS,
  PUSH_STAR_TAG,
  SET_CURRENT_LANGUAGE,
  SET_CURRENT_STAR,
  SET_CURRENT_TAG,
  SET_README,
  SET_STARS_PAGE_INFO,
  SET_STARS,
  SET_STAR_TAGS,
  SET_TAGS,
  SET_TOTAL_STARS,
  SET_USER_STARS,
  SET_VIEWING_UNTAGGED,
  SYNC_STAR_TAGS,
  MAP_USER_STARS_TO_GITHUB_STARS,
  SET_STAR_NOTES
} from '../mutation-types'

import client from './../api/client.js'

const state = {
  userStars: [],
  stars: [],
  pageInfo: {},
  totalStars: 0,
  currentLanguage: '',
  currentStar: {},
  readme: '',
  viewingUntagged: false
}

const getters = {
  stars: state => state.stars,
  pageInfo: state => state.pageInfo,
  totalStars: state => state.totalStars,
  languages: state => {
    return state.stars
      .map(star => {
        return star.node.primaryLanguage || null
      })
      .filter(Boolean)
      .map(repo => repo.name)
      .reduce((prev, cur) => {
        prev[cur] = (prev[cur] || 0) + 1
        return prev
      }, {})
  },
  currentLanguage: state => state.currentLanguage,
  currentStar: state => state.currentStar,
  currentStarIndex: state => {
    if (Object.keys(state.currentStar).length) {
      return state.stars.findIndex(
        star => star.node.id === state.currentStar.node.id
      )
    } else {
      return -1
    }
  },
  readme: state => state.readme,
  viewingUntagged: state => state.viewingUntagged
}

const mutations = {
  [SET_STARS](state, edges) {
    state.stars = state.stars.concat(edges)
  },
  [CLEAR_STARS](state) {
    state.stars = []
  },
  [SET_TOTAL_STARS](state, total) {
    state.totalStars = total
  },
  [SET_STARS_PAGE_INFO](state, info) {
    state.pageInfo = { ...info }
  },
  [SET_CURRENT_LANGUAGE](state, language) {
    state.currentLanguage = language
  },
  [PUSH_STAR_TAG](state, { starId, tag }) {
    state.stars = state.stars.map(star => {
      if (
        star.node.id === starId &&
        !star.tags.map(tag => tag.name).includes(tag.name)
      ) {
        star.tags.push(tag)
        return star
      } else {
        return star
      }
    })
  },
  [SET_STAR_TAGS](state, { starId, tags }) {
    state.stars = state.stars.map(star => {
      if (star.node.id === starId) {
        star.tags = [].concat(tags)
      }
      return star
    })
  },
  [SET_USER_STARS](state, stars) {
    state.userStars = [].concat(stars)
  },
  [MAP_USER_STARS_TO_GITHUB_STARS](state) {
    const userStars = state.userStars
    state.stars.map(star => {
      const userStar = userStars.find(s => s.relay_id === star.node.id)
      if (userStar && (userStar.tags.length || userStar.notes)) {
        if (userStar.tags.length) {
          star.tags = userStar.tags
        }
        if (userStar.notes) {
          star.notes = userStar.notes
        }
        return star
      } else {
        return star
      }
    })
  },
  [SET_CURRENT_STAR](state, star) {
    state.currentStar = { ...star }
  },
  [SET_README](state, readme) {
    state.readme = readme
  },
  [SET_VIEWING_UNTAGGED](state, viewing) {
    state.viewingUntagged = viewing
  },
  [SET_STAR_NOTES](state, { id, notes }) {
    state.stars.map(star => {
      if (star.node.id === id) {
        star.notes = notes
      }

      return star
    })
    state.currentStar = { ...state.currentStar, notes }
  }
}

const actions = {
  fetchGitHubStars({ commit }, cursor = null) {
    let url = '/api/stars/github'
    let data = cursor ? { cursor } : {}
    return client
      .withAuth()
      .get(`/api/stars/github?${qs.stringify(data)}`)
      .then(res => {
        commit(
          SET_STARS,
          res.edges.map(edge => {
            edge.tags = []
            edge.notes = ''
            return edge
          })
        )
        commit(SET_STARS_PAGE_INFO, res.pageInfo)
        if (!cursor) {
          commit(SET_TOTAL_STARS, res.totalCount)
        }

        commit(MAP_USER_STARS_TO_GITHUB_STARS)
      })
  },
  fetchUserStars({ commit }) {
    client
      .withAuth()
      .get('/api/stars')
      .then(res => {
        commit(SET_USER_STARS, res)
      })
  },
  setCurrentLanguage({ commit }, language) {
    commit(SET_CURRENT_LANGUAGE, language)
  },
  pushStarTag({ commit, rootState }, { starId, tag }) {
    commit(PUSH_STAR_TAG, { starId, tag })
    client
      .withAuth()
      .post('/api/star/tags', {
        relayId: starId,
        tagId: tag.id
      })
      .then(res => {
        commit(SET_TAGS, res.tags)
      })
  },
  setCurrentStar({ commit }, star) {
    commit(SET_CURRENT_STAR, star)
  },
  fetchReadme({ rootState, commit }, repoName) {
    const accessToken = rootState.user.user.access_token
    client
      .withoutAuth()
      .get(
        `https://api.github.com/repos/${repoName}/readme?access_token=${accessToken}`,
        {},
        {
          Accept: 'application/vnd.github.v3.html'
        }
      )
      .then(res => {
        commit(SET_README, res)
      })
  },
  setViewingUntagged({ commit }, viewing) {
    if (viewing) {
      commit(SET_CURRENT_TAG, {})
    }
    commit(SET_VIEWING_UNTAGGED, viewing)
  },
  syncStarTags({ commit }, { relayId, tags }) {
    client
      .withAuth()
      .put('/api/star/tags', {
        relayId,
        tags
      })
      .then(res => {
        commit(SET_TAGS, res.tags)
        commit(SET_STAR_TAGS, {
          starId: relayId,
          tags: res.star.tags
        })
      })
  },
  editStarNotes({ commit }, { relayId, notes }) {
    client
      .withAuth()
      .post('/api/star/notes', {
        id: relayId,
        notes
      })
      .then(res => {
        commit(SET_STAR_NOTES, {
          id: relayId,
          notes
        })
      })
  },
  cleanupStars({ commit }) {
    client
      .withAuth()
      .delete('/api/stars/cleanup')
      .then(res => {
        commit(SET_USER_STARS, res)
        commit(MAP_USER_STARS_TO_GITHUB_STARS)
      })
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}