export const format = (item) => /* html */ `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>${item.title}</title>
</head>
<body>
  <h1>${item.title}</h1>

  <section id="section-titelNaamMeetMonitorprogramma">
    <h2>Titel/naam meet/monitorprogramma</h2>
    <p>${item.titelNaamMeetMonitorprogramma}</p>
  </section>

  <section id="section-naamAansturendeOrganisatie">
    <h2>Naam aansturende organisatie (+ beheer metadata)</h2>
    <p>${item.naamAansturendeOrganisatie}</p>
  </section>

  <section id="section-datumVoltooiing">
    <h2>Datum voltooiing, volgende herziening</h2>
    <p>${item.datumVoltooiing}</p>
  </section>

  <section id="section-samenvatting">
    <h2>Samenvatting (korte beschrijving van de inhoud van de dataset)</h2>
    <p>${item.samenvatting}</p>
  </section>

  <section id="section-doelWaarvoorDataWordenVerzameld">
    <h2>Doel waarvoor data worden verzameld</h2>
    <p>${item.doelWaarvoorDataWordenVerzameld}</p>
  </section>

  <section id="section-naamUitvoerendeDienstOrganisatie">
    <h2>Naam uitvoerende dienst/organisatie (verzamelen data)</h2>
    <p>${item.naamUitvoerendeDienstOrganisatie}</p>
  </section>

  <section id="section-rolContactpersoon">
    <h2>Rol contactpersoon (beschrijving op welke wijze de perso(o)n(en) betrokken is/zijn bij de data)</h2>
    <p>${item.rolContactpersoon}</p>
  </section>

  <section id="section-geografischGebied">
    <h2>Geografisch gebied</h2>
    <p>${item.geografischGebied}</p>
  </section>

  <section id="section-gebruiksbeperkingen">
    <h2>Gebruiksbeperkingen (waarvoor zijn de data niet geschikt)</h2>
    <p>${item.gebruiksbeperkingen}</p>
  </section>

  <section id="section-overigeBeperkingenInGebruik">
    <h2>Overige beperkingen in gebruik</h2>
    <p>${item.overigeBeperkingenInGebruik}</p>
  </section>

  <section id="section-themas">
    <h2>Thema's (b.v. diversiteit, verspreiding, trends, reproductiesucces)</h2>
    <p>${item.themas
      .map((thema) => thema.title)
      .join(', ')}
    </p>
  </section>

  <section id="section-temporeleDekking">
    <h2>Temporele dekking</h2>
    <p>${item.temporeleDekking}</p>
  </section>
  
  <section id="section-volledigheid">
    <h2>Volledigheid</h2>
    <p>${item.volledigheid}</p>
  </section>

  <section id="section-nauwkeurigheid">
    <h2>Nauwkeurigheid</h2>
    <p>${item.nauwkeurigheid}</p>
  </section>

  <section id="section-algemeneBeschrijvingVanHerkomst">
    <h2>Algemene beschrijving van herkomst</h2>
    <p>${item.algemeneBeschrijvingVanHerkomst}</p>
  </section>

  <section id="section-inwinningsmethode">
    <h2>Inwinningsmethode</h2>
    <p>${item.inwinningsmethode}</p>
  </section>

  <section id="section-beschrijvingUitgevoerdeBewerkingen">
    <h2>Beschrijving uitgevoerde bewerkingen</h2>
    <p>${item.beschrijvingUitgevoerdeBewerkingen}</p>
  </section>

  <section id="section-meetvariabelen">
    <h2>Meetvariabelen</h2>
    <p>${item.meetvariabelen}</p>
  </section>

  <section id="section-meetmethodiek">
    <h2>Meetmethodiek</h2>
    <p>${item.meetmethodiek}</p>
  </section>

  <section id="section-soortDataset">
    <h2>Soort dataset (opslagmedium)</h2>
    <p>${item.soortDataset}</p>
  </section>

  <section id="section-verplichtingVanuitEuropeseRichtlijn">
    <h2>Verplichting vanuit (Europese) richtlijn</h2>
    <p>${item.verplichtingVanuitEuropeseRichtlijn}</p>
  </section>

  <section id="section-kostenOpJaarbasis">
    <h2>Kosten op jaarbasis</h2>
    <p>${item.kostenOpJaarbasis}</p>
  </section>

  <section id="section-soortenoverzicht">
    <h2>Soortenoverzicht</h2>
    <p>${item.soortenoverzicht}</p>
  </section>

  <section id="section-habitats">
    <h2>Habitats</h2>
    <p>${item.habitats}</p>
  </section>

  <section id="section-referenties">
    <h2>Referenties</h2>
    <p>${item.referenties}</p>
  </section>
</body>

</html>
`
