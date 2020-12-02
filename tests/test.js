import { Selector } from 'testcafe'
fixture `RouteAlongGeoJSONNetwork`.page `http://127.0.0.1:5500/Route%20along%20GeoJSON%20network.html`

test('Test show pins after address entered', async t => {
    await t
    .typeText("#searchBox", "Browne's Addition")
    .expect(Selector('#suggestionList').visible).eql(true)
    .click('#suggestionLable')
    .wait(8000)

    .expect(Selector('#origin').visible).eql(true)
    .expect(Selector('#from').visible).eql(true)
    .expect(Selector('#to').visible).eql(true)
})

test('Test drag and drop pins', async t => {
    await t
    .typeText("#searchBox", "Browne's Addition")
    .expect(Selector('#suggestionList').visible).eql(true)
    .click('#suggestionLable')
    .wait(8000)

    .drag(Selector('#origin'), 100, 0, {
        offsetX: 1,
        offsetY: 1,
        modifiers: {
            shift: true
        }
    })
    .wait(3000)
})
