import { Layout } from '@/components/Layout'
import { Metadata } from 'next'
import { Providers } from '../providers'

export const metadata: Metadata = {
  title: {
    template: '%s - Docs',
    default: 'build-ai - The DX first AI library made with TypeScript.',
  },
  description:
    'build-ai is a powerful TypeScript library for building AI-driven web applications. This package provides both general utilities (`build-ai`) and visual components (`build-ai/visual`).',
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
