import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getUserInitials } from '../common/userInitials.js'
import { ErrorBoundary } from '../common/ErrorBoundary.jsx'

describe('getUserInitials (R4 #12)', () => {
  it('loại bỏ thẻ (Demo) khỏi tên tiếng Việt và trả về "TN" thay vì "N("', () => {
    expect(getUserInitials('Người dùng Thử nghiệm (Demo)')).toBe('TN')
  })

  it('xử lý đúng họ tên tiếng Việt có dấu Đ, Ă, Ơ', () => {
    expect(getUserInitials('Đỗ An')).toBe('ĐA')
    expect(getUserInitials('Nguyễn Ăn Ơi')).toBe('ĂƠ')
    expect(getUserInitials('Phan Thanh Tùng')).toBe('TT')
  })

  it('xử lý tên 1 từ bằng 2 ký tự đầu in hoa theo locale vi-VN', () => {
    expect(getUserInitials('Quốc')).toBe('QU')
    expect(getUserInitials('Đức')).toBe('ĐỨ')
  })

  it('fallback sang email khi tên chỉ chứa thẻ chú thích hoặc ký tự đặc biệt', () => {
    expect(getUserInitials('(Demo) [Test]', 'demo@spendwise.vn')).toBe('DE')
    expect(getUserInitials('(Demo)', 'phan.tung@spendwise.vn')).toBe('PT')
    expect(getUserInitials('---', 'van@spendwise.vn')).toBe('VA')
  })

  it('loại bỏ chữ số và token chỉ chứa số khỏi tên hiển thị và xử lý chuỗi NFD tiếng Việt', () => {
    expect(getUserInitials('[VIP]  (Test)  123', '', 'SW')).toBe('SW')
    expect(getUserInitials('12345', 'demo@spendwise.vn', 'SW')).toBe('DE')
    expect(getUserInitials('🎉🚀✨', 'user1@test.vn', 'SW')).toBe('US')
    expect(getUserInitials('Phan Thanh Tùng'.normalize('NFD'), '', 'SW')).toBe('TT')
    expect(getUserInitials('Đỗ An'.normalize('NFD'), '', 'SW')).toBe('ĐA')
  })

  it('trả về "SW" (hoặc fallback tùy chỉnh) khi cả tên và email đều rỗng', () => {
    expect(getUserInitials('', '')).toBe('SW')
    expect(getUserInitials(null, undefined)).toBe('SW')
    expect(getUserInitials('()', '', 'ND')).toBe('ND')
  })
})

describe('ErrorBoundary (R5 #17)', () => {
  it('getDerivedStateFromError chuyển Error hoặc chuỗi thành state hasError = true', () => {
    const errState = ErrorBoundary.getDerivedStateFromError(new Error('Lỗi render biểu đồ'))
    expect(errState.hasError).toBe(true)
    expect(errState.error).toBeInstanceOf(Error)
    expect(errState.error.message).toBe('Lỗi render biểu đồ')

    const strState = ErrorBoundary.getDerivedStateFromError('Sự cố chuỗi')
    expect(strState.hasError).toBe(true)
    expect(strState.error).toBeInstanceOf(Error)
    expect(strState.error.message).toBe('Sự cố chuỗi')
  })

  it('getDerivedStateFromProps tự động reset lỗi khi resetKey (pathname) thay đổi', () => {
    const resetResult = ErrorBoundary.getDerivedStateFromProps(
      { resetKey: '/reports' },
      { hasError: true, error: new Error('Crash'), prevResetKey: '/budgets' }
    )
    expect(resetResult).toEqual({
      hasError: false,
      error: null,
      prevResetKey: '/reports',
    })

    const sameKeyResult = ErrorBoundary.getDerivedStateFromProps(
      { resetKey: '/budgets' },
      { hasError: true, error: new Error('Crash'), prevResetKey: '/budgets' }
    )
    expect(sameKeyResult).toBeNull()
  })

  it('render giao diện khôi phục Double-Bezel tiếng Việt khi có lỗi', () => {
    const boundary = new ErrorBoundary({
      fullScreen: true,
      resetKey: '/',
      children: React.createElement('div', null, 'Nội dung bình thường'),
    })
    boundary.state = {
      ...ErrorBoundary.getDerivedStateFromError(new Error('Lỗi kết nối dịch vụ')),
      prevResetKey: '/',
    }

    const html = renderToStaticMarkup(boundary.render())
    expect(html).toContain('role="alert"')
    expect(html).toContain('Giao diện gặp sự cố tạm thời')
    expect(html).toContain('Lỗi kết nối dịch vụ')
    expect(html).toContain('Thử lại')
    expect(html).toContain('Tải lại trang')
    expect(html).toContain('Về trang chủ')
    expect(html).toContain('rounded-[2rem]')
    expect(html).toContain('dark:bg-[#0B0F19]')
  })

  it('render children bình thường khi không có lỗi', () => {
    const boundary = new ErrorBoundary({
      resetKey: '/',
      children: React.createElement('main', null, 'Nội dung SpendWise'),
    })

    const html = renderToStaticMarkup(boundary.render())
    expect(html).toBe('<main>Nội dung SpendWise</main>')
  })
})
