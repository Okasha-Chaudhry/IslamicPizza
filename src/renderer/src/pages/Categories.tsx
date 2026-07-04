import EntityManagerPage from '@/components/shared/EntityManagerPage'

export default function Categories(): React.JSX.Element {
  return (
    <EntityManagerPage
      title="Categories"
      placeholder="Category name (e.g. Pizza)"
      api={window.api.categories}
    />
  )
}