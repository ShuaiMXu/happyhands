// Edit the visible fields without dropping adopted remediation settings.
export function editedDesignProfile(initial, taste, intent, dials) {
  const {dials: previousDials, ...retained} = initial || {};
  return {...retained, taste, intent, ...(taste === 'dials-v1' ? {dials} : {})};
}
