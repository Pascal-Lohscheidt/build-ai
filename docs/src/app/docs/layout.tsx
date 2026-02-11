import { Layout } from '@/components/Layout'
import { Metadata } from 'next'
import { Providers } from '../providers'

export const metadata: Metadata = {
  title: {
    template: '%s - Docs',
    default: '@m4trix/core - The DX first AI library made with TypeScript.',
  },
  description:
    '@m4trix/core is a powerful TypeScript library for building AI-driven web applications. This package provides both general utilities (`@m4trix/core`) and modular entry points like (`@m4trix/core/ui`).',
}

export default function LayoutPage({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      <Layout>{children}</Layout>
    </Providers>
  )
}
