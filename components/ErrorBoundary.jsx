'use client'

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <p style={{ color: '#7d8590', fontSize: 12 }}>
            Something went wrong loading this widget.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
