// jest.setup.js
import '@testing-library/jest-dom'

// Polyfills para APIs de Web que no están en jsdom
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock de Request y Response para tests de API
class MockRequest {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new Map(Object.entries(options.headers || {}))
    this._body = options.body
  }

  async json() {
    return JSON.parse(this._body)
  }

  async text() {
    return this._body
  }
}

class MockResponse {
  constructor(body, options = {}) {
    this._body = body
    this.status = options.status || 200
    this.headers = new Map(Object.entries(options.headers || {}))
  }

  async json() {
    return JSON.parse(this._body)
  }
}

if (typeof global.Request === 'undefined') {
  global.Request = MockRequest
}

if (typeof global.Response === 'undefined') {
  global.Response = MockResponse
}
