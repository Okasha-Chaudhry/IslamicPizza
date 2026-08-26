import EntityManagerPage from '@/components/shared/EntityManagerPage'

export default function KitchenSections(): React.JSX.Element {
  return (
    <EntityManagerPage
      title="Kitchen Sections"
      placeholder="Section name (e.g. BBQ, Tandoor, Karahi)"
      api={window.api.kitchenSections}
    />
  )
}
