export const format = (item) => /* html */ `
<!DOCTYPE html>
<html>
<head>
  <title>${item.title}</title>
</head>
<body>
  <h1>${item.title}</h1>

  <h2>Titel/naam meet/monitorprogramma</h2>
  <p>${item.metadata.citationTitle}</p>

  <h2>Naam aansturende organisatie (+ beheer metadata)</h2>
  <p>${item.naamAansturendeOrganisatie}</p>

  <h2>Datum voltooiing, volgende herziening</h2>
  <p>${item.datumVoltooiing}</p>

  <h2>Samenvatting (korte beschrijving van de inhoud van de dataset)</h2>
  <p>${item.metadata.abstract}</p>

  <h2>Doel waarvoor data worden verzameld</h2>
  <p>${item.doelWaarvoorDataWordenVerzameld}</p>

  <h2>Naam uitvoerende dienst/organisatie (verzamelen data)</h2>
  <p>${item.naamUitvoerendeDienstOrganisatie}</p>

  <h2>Rol contactpersoon (beschrijving op welke wijze de perso(o)n(en) betrokken is/zijn bij de data)</h2>
  <p>${item.rolContactpersoon}</p>

  <h2>Geografisch gebied</h2>
  <p>${item.geografischGebied}</p>

  <h2>Gebruiksbeperkingen (waarvoor zijn de data niet geschikt)</h2>
  <p>${item.gebruiksbeperkingen}</p>

  <h2>Overige beperkingen in gebruik</h2>
  <p>${item.overigeBeperkingenInGebruik}</p>

  <h2>Thema's (b.v. diversiteit, verspreiding, trends, reproductiesucces)</h2>
  <p>${item.metadata.descriptivekeywordsKeywords
    .map((keyword) => keyword.title)
    .join(', ')}
  </p>

  <h2>Temporele dekking</h2>
  <p>${item.temporeleDekking}</p>
  
  <h2>Volledigheid</h2>
  <p>${item.volledigheid}</p>

  <h2>Nauwkeurigheid</h2>
  <p>${item.nauwkeurigheid}</p>

  <h2>Algemene beschrijving van herkomst</h2>
  <p>${item.algemeneBeschrijvingVanHerkomst}</p>

  <h2>Inwinningsmethode</h2>
  <p>${item.inwinningsmethode}</p>

  <h2>Beschrijving uitgevoerde bewerkingen</h2>
  <p>${item.beschrijvingUitgevoerdeBewerkingen}</p>

  <h2>Meetvariabelen</h2>
  <p>${item.meetvariabelen}</p>

  <h2>Meetmethodiek</h2>
  <p>${item.meetmethodiek}</p>

  <h2>Soort dataset (opslagmedium)</h2>
  <p>${item.soortDataset}</p>

  <h2>Verplichting vanuit (Europese) richtlijn</h2>
  <p>${item.verplichtingVanuitEuropeseRichtlijn}</p>

  <h2>Kosten op jaarbasis</h2>
  <p>${item.kostenOpJaarbasis}</p>

  <h2>Soortenoverzicht</h2>
  <p>${item.soortenoverzicht}</p>

  <h2>Habitats</h2>
  <p>${item.habitats}</p>

  <h2>Referenties</h2>
  <p>${item.referenties}</p>
</body>

</html>
`
