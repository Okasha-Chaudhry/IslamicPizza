import EntityManagerPage from '@/components/shared/EntityManagerPage'

export default function Tables(): React.JSX.Element {
  return <EntityManagerPage title="Tables" placeholder="Table name (e.g. Table 1)" api={window.api.tables} />
}