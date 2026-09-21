import { describe, expect, it } from 'vitest'
import { isBlockedHostname } from './security'

describe('isBlockedHostname', () => {
  it('allows public hostnames', () => {
    expect(isBlockedHostname('example.com')).toBe(false)
    expect(isBlockedHostname('10.example.com')).toBe(false)
    expect(isBlockedHostname('fcorp.com')).toBe(false)
    expect(isBlockedHostname('192.168.1.example.com')).toBe(false)
    expect(isBlockedHostname('8.8.8.8')).toBe(false)
  })

  it('blocks localhost and internal suffixes', () => {
    expect(isBlockedHostname('localhost')).toBe(true)
    expect(isBlockedHostname('api.localhost')).toBe(true)
    expect(isBlockedHostname('printer.local')).toBe(true)
    expect(isBlockedHostname('service.internal')).toBe(true)
    expect(isBlockedHostname('router.home.arpa')).toBe(true)
  })

  it('blocks private and link-local IPv4 literals', () => {
    expect(isBlockedHostname('127.0.0.1')).toBe(true)
    expect(isBlockedHostname('10.0.0.7')).toBe(true)
    expect(isBlockedHostname('172.16.0.1')).toBe(true)
    expect(isBlockedHostname('172.31.255.255')).toBe(true)
    expect(isBlockedHostname('172.32.0.1')).toBe(false)
    expect(isBlockedHostname('192.168.0.1')).toBe(true)
    expect(isBlockedHostname('169.254.169.254')).toBe(true)
    expect(isBlockedHostname('0.0.0.0')).toBe(true)
    expect(isBlockedHostname('100.64.0.1')).toBe(true)
    expect(isBlockedHostname('100.128.0.1')).toBe(false)
  })

  it('blocks loopback and unique-local IPv6', () => {
    expect(isBlockedHostname('[::1]')).toBe(true)
    expect(isBlockedHostname('[fe80::1]')).toBe(true)
    expect(isBlockedHostname('[fd00::1]')).toBe(true)
    expect(isBlockedHostname('[fc00::1]')).toBe(true)
    expect(isBlockedHostname('[2001:db8::1]')).toBe(false)
  })
})
