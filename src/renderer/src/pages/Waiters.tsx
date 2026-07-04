import EntityManagerPage from '@/components/shared/EntityManagerPage'

export default function Waiters(): React.JSX.Element {
  return <EntityManagerPage title="Waiters" placeholder="Waiter name (e.g. Ahmed)" api={window.api.waiters} />
}