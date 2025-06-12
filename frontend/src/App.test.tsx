import React from 'react';
import { render, screen } from '@testing-library/react';
import MemberNew from './MemberNew';

test('renders learn react link', () => {
  render(<MemberNew />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
