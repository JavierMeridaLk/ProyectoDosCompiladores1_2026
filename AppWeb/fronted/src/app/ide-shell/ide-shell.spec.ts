import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdeShell } from './ide-shell';

describe('IdeShell', () => {
  let component: IdeShell;
  let fixture: ComponentFixture<IdeShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdeShell],
    }).compileComponents();

    fixture = TestBed.createComponent(IdeShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
