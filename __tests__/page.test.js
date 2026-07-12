import React from 'react'
import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import TeacherProgressApp from '../components/teacher-progress-app.jsx'
 
test('role entry', () => {
  render(React.createElement(TeacherProgressApp, { view: 'roles' }))
  expect(screen.getByRole('heading', { level: 1, name: 'How will you use Quran Minds?' })).toBeDefined()
  expect(screen.getByRole('link', { name: /I am a Teacher/ }).getAttribute('href')).toBe('/teacher')
})
